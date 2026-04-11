import { Prisma, TransactionType } from "@prisma/client"
import { beforeAll, describe, expect, test } from "bun:test"
import { createHmac } from "node:crypto"
import { FastifyInstance } from "fastify"

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
  SUDO_BASE_URL: "https://api.sudo.africa",
  SUDO_DEFAULT_CUSTOMER_ID: "customer_test_123",
  SUDO_WEBHOOK_SECRET: "test-webhook-secret",
  JWT_SECRET: "test-jwt-secret-test-jwt-secret-1234",
  JWT_EXPIRES_IN: "24h",
} as const

type HandleCardIssuerWebhook = (
  app: FastifyInstance,
  body: {
    _id?: string
    type?: string
    event?: string
    data?: {
      _id?: string
      cardId?: string
      amount?: string | number
      merchantName?: string
      merchantCategory?: string
      object?: {
        _id?: string
        card?: string | { _id?: string }
        amount?: string | number
        merchant?: {
          name?: string
          category?: string
        }
        transactionMetadata?: {
          type?: string
        }
      }
    }
  },
  signature: string | undefined,
  rawBody: string,
) => Promise<Record<string, unknown>>

let handleCardIssuerWebhook: HandleCardIssuerWebhook

beforeAll(async () => {
  Object.assign(process.env, REQUIRED_ENV)

  ;({ handleCardIssuerWebhook } = await import(
    "../src/modules/webhooks/webhooks.service.ts"
  ))
})

function makeSignature(payload: object) {
  return createHmac("sha256", REQUIRED_ENV.SUDO_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex")
}

function makeHttpErrors() {
  return {
    unauthorized(message: string) {
      const error = new Error(message)
      ;(error as Error & { statusCode: number }).statusCode = 401
      return error
    },
    badRequest(message: string) {
      const error = new Error(message)
      ;(error as Error & { statusCode: number }).statusCode = 400
      return error
    },
    notFound(message: string) {
      const error = new Error(message)
      ;(error as Error & { statusCode: number }).statusCode = 404
      return error
    },
  }
}

describe("handleCardIssuerWebhook", () => {
  test("rejects invalid signature", async () => {
    const app = {
      httpErrors: makeHttpErrors(),
      prisma: {
        card: { findUnique: async () => null },
      },
    } as unknown as FastifyInstance

    await expect(
      handleCardIssuerWebhook(
        app,
        {
          event: "card.charge",
          data: { cardId: "card_1", amount: "12.00" },
        },
        "wrong-signature",
        JSON.stringify({
          event: "card.charge",
          data: { cardId: "card_1", amount: "12.00" },
        }),
      ),
    ).rejects.toThrow("Invalid webhook signature")
  })

  test("rejects charges that exceed RUBBI balance", async () => {
    const payload = {
      event: "card.charge",
      data: {
        cardId: "issuer-card-1",
        amount: "50.00",
        merchantName: "Netflix",
      },
    }

    const app = {
      httpErrors: makeHttpErrors(),
      prisma: {
        card: {
          findUnique: async () => ({
            id: "card-db-id",
            issuerId: "issuer-card-1",
            user: {
              id: "user-1",
              rubbiBalance: new Prisma.Decimal("10.00"),
            },
          }),
        },
      },
    } as unknown as FastifyInstance

    await expect(
      handleCardIssuerWebhook(
        app,
        payload,
        makeSignature(payload),
        JSON.stringify(payload),
      ),
    ).rejects.toThrow("Insufficient RUBBI balance")
  })

  test("processes valid spend and records ledger mutation", async () => {
    const payload = {
      event: "card.charge",
      data: {
        cardId: "issuer-card-2",
        amount: "15.25",
        merchantName: "DSTV",
        merchantCategory: "streaming",
      },
    }

    const txCalls: { created: boolean; updated: boolean; data?: unknown } = {
      created: false,
      updated: false,
    }

    const app = {
      httpErrors: makeHttpErrors(),
      prisma: {
        card: {
          findUnique: async () => ({
            id: "card-db-id-2",
            issuerId: "issuer-card-2",
            user: {
              id: "user-2",
              rubbiBalance: new Prisma.Decimal("100.00"),
            },
          }),
        },
        $transaction: async (callback: (tx: any) => Promise<void>) => {
          await callback({
            user: {
              update: async () => {
                txCalls.updated = true
                return { rubbiBalance: new Prisma.Decimal("84.75") }
              },
            },
            transaction: {
              create: async (input: { data: unknown }) => {
                txCalls.created = true
                txCalls.data = input.data
              },
            },
          })
        },
      },
    } as unknown as FastifyInstance

    const result = await handleCardIssuerWebhook(
      app,
      payload,
      makeSignature(payload),
      JSON.stringify(payload),
    )

    expect(result).toEqual({ ok: true })
    expect(txCalls.updated).toBeTrue()
    expect(txCalls.created).toBeTrue()
    expect(txCalls.data).toMatchObject({
      userId: "user-2",
      type: TransactionType.SPEND,
      description: "DSTV charge",
    })
  })

  test("processes Sudo transaction.created payload shape", async () => {
    const payload = {
      type: "transaction.created",
      data: {
        _id: "webhook-data-1",
        object: {
          _id: "txn_1",
          card: "issuer-card-3",
          amount: -7.5,
          merchant: {
            name: "Canva",
            category: "software",
          },
          transactionMetadata: {
            type: "purchase",
          },
        },
      },
    }

    const txCalls: { updated: boolean } = { updated: false }

    const app = {
      httpErrors: makeHttpErrors(),
      redis: {
        set: async () => "OK",
      },
      prisma: {
        card: {
          findUnique: async () => ({
            id: "card-db-id-3",
            issuerId: "issuer-card-3",
            user: {
              id: "user-3",
              rubbiBalance: new Prisma.Decimal("100.00"),
            },
          }),
        },
        $transaction: async (callback: (tx: any) => Promise<void>) => {
          await callback({
            user: {
              update: async () => {
                txCalls.updated = true
                return { rubbiBalance: new Prisma.Decimal("92.50") }
              },
            },
            transaction: {
              create: async () => undefined,
            },
          })
        },
      },
    } as unknown as FastifyInstance

    const result = await handleCardIssuerWebhook(
      app,
      payload,
      makeSignature(payload),
      JSON.stringify(payload),
    )

    expect(result).toMatchObject({ ok: true })
    expect(txCalls.updated).toBeTrue()
  })
})
