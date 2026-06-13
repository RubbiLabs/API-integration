import { beforeAll, describe, expect, mock, test } from "bun:test"
import { seedEnv } from "./helpers.js"

// Mock ioredis to prevent real Redis connections from queue.ts
const MockRedisClass = class MockRedis {
  on() { return this }
  quit() { return Promise.resolve() }
}
mock.module("ioredis", () => ({
  default: MockRedisClass,
  Redis: MockRedisClass,
}))

// Mock bullmq
mock.module("bullmq", () => ({
  Worker: class MockWorker {
    constructor() {}
    on() { return this }
    close() {}
  },
  Queue: class MockQueue {
    add() { return { id: "mock" } }
    close() {}
  },
}))

beforeAll(() => {
  seedEnv()
})

describe("startSubscriptionWorker", () => {
  test("creates worker and counts active subscriptions", async () => {
    const { startSubscriptionWorker } = await import("../src/workers/subscription.worker.js")

    const app = {
      prisma: {
        subscription: {
          count: async () => 3,
        },
      },
      log: { info: () => undefined, error: () => undefined },
    } as any

    const worker = startSubscriptionWorker(app)
    expect(worker).toBeDefined()
    worker.close()
  })
})
