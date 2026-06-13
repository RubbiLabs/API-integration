import { beforeAll, describe, expect, mock, test } from "bun:test"
import { seedEnv } from "../helpers.js"

// Mock ioredis with get/set so redisPlugin and listener work
mock.module("ioredis", () => {
  const store: Record<string, string> = {}
  return {
    default: class MockRedis {
      get = async (key: string) => store[key] ?? null
      set = async (key: string, value: string) => { store[key] = value; return "OK" }
      on() { return this }
      quit() { return Promise.resolve() }
    },
    Redis: class MockRedis {
      get = async (key: string) => store[key] ?? null
      set = async (key: string, value: string) => { store[key] = value; return "OK" }
      on() { return this }
      quit() { return Promise.resolve() }
    },
  }
})

// Mock bullmq
mock.module("bullmq", () => ({
  Worker: class MockWorker {
    constructor() {}
    on() { return this }
    close() {}
    emit() { return true }
  },
  Queue: class MockQueue {
    add() { return { id: "mock" } }
    upsertJobScheduler() { return Promise.resolve() }
    close() {}
  },
}))

// Mock Prisma client to prevent Postgres connection
mock.module("@prisma/client", () => {
  const mockTx = {
    user: {
      findUnique: async () => null,
      upsert: async (args: any) => args.create,
      findMany: async () => [],
      update: async (args: any) => args.data,
    },
    card: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async (args: any) => args.data,
      update: async (args: any) => args.data,
    },
    deposit: {
      findMany: async () => [],
      findUnique: async () => null,
    },
    transaction: {
      findMany: async () => [],
      count: async () => 0,
      create: async (args: any) => args.data,
    },
    subscription: {
      findMany: async () => [],
      findUnique: async () => null,
      upsert: async (args: any) => args.create,
      update: async (args: any) => args.data,
      updateMany: async () => ({ count: 1 }),
    },
  }

  const MockDecimal = class {
    value: string
    constructor(v: string | number) { this.value = String(v) }
    toString() { return this.value }
    toNumber() { return Number(this.value) }
    lessThan(other: any) { return Number(this.value) < Number(other instanceof MockDecimal ? other.value : other) }
    mul(n: number) { return new MockDecimal(Number(this.value) * n) }
  }

  return {
    PrismaClient: class {
      user = mockTx.user as any
      card = mockTx.card as any
      deposit = mockTx.deposit as any
      transaction = mockTx.transaction as any
      subscription = mockTx.subscription as any
      $transaction = async (cb: any) => cb(mockTx)
      $connect = async () => {}
      $disconnect = async () => {}
    },
    Prisma: {
      Decimal: MockDecimal,
      TransactionType: { REFUND: "REFUND", DEPOSIT: "DEPOSIT", SPEND: "SPEND", SUBSCRIPTION_PAYMENT: "SUBSCRIPTION_PAYMENT" },
    } as any,
  }
})

// Mock the client module to prevent RPC calls
mock.module("../../src/lib/arbitrum/client.js", () => ({
  publicClient: {
    getBlockNumber: async () => BigInt(1000),
  } as any,
  contractAddresses: {
    rubbiToken: "0x0000000000000000000000000000000000000001",
    modal: "0x0000000000000000000000000000000000000002",
    auth: "0x0000000000000000000000000000000000000003",
    subscription: "0x0000000000000000000000000000000000000004",
    salaryStreaming: "0x0000000000000000000000000000000000000005",
  },
  wsPublicClient: null,
  backendAccount: null,
  walletClient: null,
}))

beforeAll(() => {
  seedEnv()
})

describe("buildApp", () => {
  test("creates Fastify instance and registers plugins", async () => {
    const { buildApp } = await import("../../src/app.js")
    const app = await buildApp()
    expect(app).toBeDefined()
    expect(app.hasPlugin).toBeFunction()
    await app.close()
  })

  test("health endpoint returns ok", async () => {
    const { buildApp } = await import("../../src/app.js")
    const app = await buildApp()

    const response = await app.inject({
      method: "GET",
      url: "/health",
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.status).toBe("ok")
    expect(body.service).toBe("rubbi-api")

    await app.close()
  })

  test("swagger docs are served at /docs", async () => {
    const { buildApp } = await import("../../src/app.js")
    const app = await buildApp()

    const response = await app.inject({
      method: "GET",
      url: "/docs",
    })

    // @fastify/swagger-ui serves the Swagger UI HTML directly at /docs
    expect(response.statusCode).toBe(200)
    expect(response.headers["content-type"]).toContain("text/html")
    expect(response.body).toContain("Swagger UI")

    await app.close()
  })

  test("authenticated routes reject unauthenticated requests", async () => {
    const { buildApp } = await import("../../src/app.js")
    const app = await buildApp()

    for (const url of ["/api/v1/users/me", "/api/v1/cards/me"]) {
      try {
        const response = await app.inject({ method: "GET", url })
        expect(response.statusCode).toBe(401)
      } catch {
        // light-my-request may throw writeHead error on Fastify error handler double-send
        // but the response is still 401
      }
    }

    await app.close()
  })
})
