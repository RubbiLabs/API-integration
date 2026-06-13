import { Prisma } from "@prisma/client"
import type { FastifyInstance } from "fastify"

export const TEST_ENV = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "postgresql://user:password@localhost:5432/rubbi",
  REDIS_URL: "redis://localhost:6379",
  ARBITRUM_RPC_URL: "https://arb1.arbitrum.io/rpc",
  ARBITRUM_CHAIN_ID: "42161",
  ARBITRUM_LOG_BACKFILL_CHUNK: "100",
  ARBITRUM_SETTLEMENT_TAG: "safe",
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

export function seedEnv() {
  Object.assign(process.env, TEST_ENV)
}

export function makeHttpErrors() {
  return {
    badRequest(message: string) {
      const err = new Error(message) as Error & { statusCode: number }
      err.statusCode = 400
      return err
    },
    unauthorized(message: string) {
      const err = new Error(message) as Error & { statusCode: number }
      err.statusCode = 401
      return err
    },
    notFound(message: string) {
      const err = new Error(message) as Error & { statusCode: number }
      err.statusCode = 404
      return err
    },
    conflict(message: string) {
      const err = new Error(message) as Error & { statusCode: number }
      err.statusCode = 409
      return err
    },
    forbidden(message: string) {
      const err = new Error(message) as Error & { statusCode: number }
      err.statusCode = 403
      return err
    },
    internalServerError(message: string) {
      const err = new Error(message) as Error & { statusCode: number }
      err.statusCode = 500
      return err
    },
  }
}

export function makeRedis(setResponse: string | null = "OK") {
  return {
    get: async () => null,
    set: async () => setResponse,
    quit: async () => undefined,
  }
}

export function makeJwt() {
  return {
    sign: (payload: Record<string, unknown>) => `mock-token-${JSON.stringify(payload)}`,
  }
}

export function makeTx(overrides?: Partial<{
  userId: string
  type: string
  amountRubbi: Prisma.Decimal
  balanceAfter: Prisma.Decimal
  description: string
  createdAt: Date
  metadata: Record<string, unknown>
  id: string
}>) {
  return {
    id: overrides?.id ?? "txn-1",
    userId: overrides?.userId ?? "user-1",
    type: overrides?.type ?? "DEPOSIT",
    amountRubbi: overrides?.amountRubbi ?? new Prisma.Decimal("10.00"),
    balanceAfter: overrides?.balanceAfter ?? new Prisma.Decimal("100.00"),
    description: overrides?.description ?? "Test transaction",
    metadata: overrides?.metadata ?? null,
    createdAt: overrides?.createdAt ?? new Date("2026-01-01"),
  }
}

export function makeCard(overrides?: Partial<{
  id: string
  userId: string
  issuerId: string
  last4: string
  expiryMonth: string
  expiryYear: string
  status: string
}>) {
  const card = {
    id: overrides?.id ?? "card-1",
    userId: overrides?.userId ?? "user-1",
    issuerId: overrides?.issuerId ?? "issuer-card-1",
    last4: overrides?.last4 ?? "1234",
    expiryMonth: overrides?.expiryMonth ?? "12",
    expiryYear: overrides?.expiryYear ?? "28",
    status: overrides?.status ?? "ACTIVE",
  }
  return card
}

export function makeUser(overrides?: Partial<{
  id: string
  walletAddress: string
  username: string
  rubbiBalance: Prisma.Decimal
  card: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}>) {
  return {
    id: overrides?.id ?? "user-1",
    walletAddress: overrides?.walletAddress ?? "0xuser000000000000000000000000000000000001",
    username: overrides?.username ?? "testuser",
    rubbiBalance: overrides?.rubbiBalance ?? new Prisma.Decimal("100.00"),
    card: overrides?.card ?? null,
    createdAt: overrides?.createdAt ?? new Date("2026-01-01"),
    updatedAt: overrides?.updatedAt ?? new Date("2026-01-01"),
  }
}

export function makeDeposit(overrides?: Partial<{
  id: string
  userId: string
  txHash: string
  amountRaw: string
  amountRubbi: Prisma.Decimal
  status: string
  blockNumber: bigint
  confirmedAt: Date | null
  createdAt: Date
}>) {
  return {
    id: overrides?.id ?? "deposit-1",
    userId: overrides?.userId ?? "user-1",
    txHash: overrides?.txHash ?? "0x0000000000000000000000000000000000000000000000000000000000000001",
    amountRaw: overrides?.amountRaw ?? "10000000000000000000",
    amountRubbi: overrides?.amountRubbi ?? new Prisma.Decimal("10.00"),
    status: overrides?.status ?? "CONFIRMED",
    blockNumber: overrides?.blockNumber ?? BigInt(1000),
    confirmedAt: overrides?.confirmedAt ?? new Date("2026-01-01"),
    createdAt: overrides?.createdAt ?? new Date("2026-01-01"),
  }
}

export function makeSubscription(overrides?: Partial<{
  id: string
  userId: string
  onChainPlanId: number
  planName: string
  feeRubbi: Prisma.Decimal
  status: string
  createdAt: Date
  updatedAt: Date
}>) {
  return {
    id: overrides?.id ?? "sub-1",
    userId: overrides?.userId ?? "user-1",
    onChainPlanId: overrides?.onChainPlanId ?? 0,
    planName: overrides?.planName ?? "Netflix",
    feeRubbi: overrides?.feeRubbi ?? new Prisma.Decimal("15.00"),
    status: overrides?.status ?? "ACTIVE",
    createdAt: overrides?.createdAt ?? new Date("2026-01-01"),
    updatedAt: overrides?.updatedAt ?? new Date("2026-01-01"),
  }
}

export type MockApp = ReturnType<typeof makeMockApp>

export function makeMockApp(overrides?: {
  userFindUnique?: unknown
  prismaTransaction?: unknown
  cardFindUnique?: unknown
  cardFindFirst?: unknown
  redisSet?: string | null
}) {
  const httpErrors = makeHttpErrors()

  const defaultTransaction = async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
    const tx = {
      user: {
        update: async ({ data, select }: { data: Record<string, unknown>; select: Record<string, unknown> }) => ({
          rubbiBalance: data.rubbiBalance?.increment
            ? new Prisma.Decimal("110.00")
            : new Prisma.Decimal("90.00"),
        }),
      },
      deposit: {
        findUnique: async () => null,
        create: async ({ data }: { data: { amountRubbi: Prisma.Decimal } }) => ({
          id: "deposit-new",
          amountRubbi: data.amountRubbi,
        }),
        update: async () => ({}),
      },
      transaction: {
        create: async () => ({ id: "txn-new" }),
      },
      subscription: {
        upsert: async () => ({}),
        updateMany: async () => ({ count: 1 }),
      },
    }
    return cb(tx)
  }

  const app = {
    prisma: {
      user: {
        findUnique: overrides?.userFindUnique ?? (async () => makeUser()),
        findFirst: async () => null,
        upsert: async () => makeUser(),
        update: async () => makeUser(),
        count: async () => 5,
      },
      card: {
        findUnique: overrides?.cardFindUnique ?? (async () => ({
          ...makeCard(),
          user: makeUser({ rubbiBalance: new Prisma.Decimal("100.00") }),
        })),
        findFirst: overrides?.cardFindFirst ?? (async () => makeCard()),
        create: async () => makeCard(),
        update: async () => makeCard(),
        count: async () => 1,
      },
      deposit: {
        findUnique: async () => null,
        findMany: async () => [makeDeposit()],
        findFirst: async () => makeDeposit(),
        count: async () => 1,
        create: async () => makeDeposit(),
      },
      transaction: {
        findMany: async () => [makeTx()],
        count: async () => 1,
        create: async () => ({ id: "txn-new" }),
      },
      subscription: {
        findUnique: async () => null,
        findMany: async () => [makeSubscription()],
        count: async () => 3,
        upsert: async () => makeSubscription(),
        updateMany: async () => ({ count: 1 }),
        create: async () => makeSubscription(),
      },
      $transaction: overrides?.prismaTransaction ?? defaultTransaction,
    },
    redis: makeRedis(overrides?.redisSet ?? "OK"),
    cardIssuer: {
      createVirtualCard: async () => ({
        id: "issuer-card-new",
        last4: "5678",
        expiryMonth: "12",
        expiryYear: "29",
        status: "ACTIVE" as const,
      }),
      fundCard: async () => undefined,
      freezeCard: async () => undefined,
      unfreezeCard: async () => undefined,
      getCardDetails: async () => ({
        id: "issuer-card-1",
        last4: "1234",
        expiryMonth: "12",
        expiryYear: "28",
        status: "ACTIVE" as const,
        pan: "4111111111111234",
      }),
    },
    jwt: makeJwt(),
    httpErrors,
    log: {
      info: () => undefined,
      error: () => undefined,
      warn: () => undefined,
      debug: () => undefined,
    },
  } as unknown as FastifyInstance

  return app
}
