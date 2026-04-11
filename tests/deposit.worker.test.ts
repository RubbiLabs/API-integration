import { Prisma, TransactionType } from "@prisma/client"
import { beforeAll, describe, expect, test } from "bun:test"
import { FastifyInstance } from "fastify"

type ProcessDepositJob = (
  app: FastifyInstance,
  data: {
    walletAddress: string
    txHash: string
    amountRaw: string
    blockNumber: string
  },
  enqueueTopup?: (payload: {
    userId: string
    depositId: string
    amountRubbi: string
  }) => Promise<void>,
) => Promise<{ ok: true }>

let processDepositJob: ProcessDepositJob

const REQUIRED_ENV = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "postgresql://user:password@localhost:5432/rubbi",
  REDIS_URL: "redis://localhost:6379",
  MONAD_RPC_URL: "https://rpc.monad.xyz",
  MONAD_CHAIN_ID: "10143",
  RUBBI_TOKEN_ADDRESS: "0x0000000000000000000000000000000000000001",
  MODAL_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000002",
  AUTH_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000003",
  SUBSCRIPTION_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000004",
  SALARY_STREAMING_ADDRESS: "0x0000000000000000000000000000000000000005",
  BACKEND_WALLET_PRIVATE_KEY:
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  SUDO_API_KEY: "test-key",
  SUDO_BASE_URL: "https://api.sudo.africa/v2",
  SUDO_WEBHOOK_SECRET: "test-webhook-secret",
  JWT_SECRET: "test-jwt-secret-test-jwt-secret-1234",
  JWT_EXPIRES_IN: "24h",
} as const

beforeAll(async () => {
  Object.assign(process.env, REQUIRED_ENV)
  ;({ processDepositJob } = await import("../src/workers/deposit.processor.ts"))
})

describe("processDepositJob", () => {
  test("creates deposit, ledger transaction, and enqueues topup", async () => {
    const calls: {
      amountRubbi?: Prisma.Decimal
      txType?: TransactionType
      enqueue?: { userId: string; depositId: string; amountRubbi: string }
    } = {}

    const app = {
      prisma: {
        user: {
          findUnique: async () => ({ id: "user-1" }),
        },
        $transaction: async (callback: (tx: any) => Promise<any>) =>
          callback({
            deposit: {
              findUnique: async () => null,
              create: async ({ data }: { data: { amountRubbi: Prisma.Decimal } }) => {
                calls.amountRubbi = data.amountRubbi
                return { id: "deposit-1", amountRubbi: data.amountRubbi }
              },
            },
            user: {
              update: async () => ({ rubbiBalance: new Prisma.Decimal("21.0") }),
            },
            transaction: {
              create: async ({ data }: { data: { type: TransactionType } }) => {
                calls.txType = data.type
              },
            },
          }),
      },
    } as unknown as FastifyInstance

    const result = await processDepositJob(
      app,
      {
        walletAddress: "0xABcdef0000000000000000000000000000000000",
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        amountRaw: "1000000000000000000",
        blockNumber: "123",
      },
      async (payload) => {
        calls.enqueue = payload
      },
    )

    expect(result).toEqual({ ok: true })
    expect(calls.amountRubbi?.toString()).toBe("1")
    expect(calls.txType).toBe(TransactionType.DEPOSIT)
    expect(calls.enqueue).toEqual({
      userId: "user-1",
      depositId: "deposit-1",
      amountRubbi: "1",
    })
  })

  test("uses existing deposit during dedup and still enqueues topup", async () => {
    const calls: { created: boolean; enqueue?: { amountRubbi: string } } = {
      created: false,
    }

    const app = {
      prisma: {
        user: {
          findUnique: async () => ({ id: "user-2" }),
        },
        $transaction: async (callback: (tx: any) => Promise<any>) =>
          callback({
            deposit: {
              findUnique: async () => ({
                id: "deposit-seen",
                amountRubbi: new Prisma.Decimal("2.5"),
              }),
              create: async () => {
                calls.created = true
                return { id: "should-not-run" }
              },
            },
            user: {
              update: async () => ({ rubbiBalance: new Prisma.Decimal("0") }),
            },
            transaction: {
              create: async () => {
                calls.created = true
              },
            },
          }),
      },
    } as unknown as FastifyInstance

    await processDepositJob(
      app,
      {
        walletAddress: "0xabcdef0000000000000000000000000000000000",
        txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
        amountRaw: "2500000000000000000",
        blockNumber: "124",
      },
      async (payload) => {
        calls.enqueue = { amountRubbi: payload.amountRubbi }
      },
    )

    expect(calls.created).toBeFalse()
    expect(calls.enqueue).toEqual({ amountRubbi: "2.5" })
  })
})
