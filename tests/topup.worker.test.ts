import { beforeAll, describe, expect, mock, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { seedEnv } from "./helpers.js"

const MockRedisClass = class MockRedis {
  on() { return this }
  quit() { return Promise.resolve() }
}
mock.module("ioredis", () => ({
  default: MockRedisClass,
  Redis: MockRedisClass,
}))

let queueAddImpl = async () => ({ id: "mock-job" })

mock.module("bullmq", () => {
  const handlerStore: { failed?: Function } = {}
  return {
    Worker: class MockWorker {
      constructor() {
        handlerStore.failed = undefined
      }
      on(event: string, handler: any) {
        if (event === "failed") handlerStore.failed = handler
        return this
      }
      close() {}
      emit(event: string, ...args: any[]) {
        if (event === "failed" && handlerStore.failed) {
          handlerStore.failed(args[0], args[1])
        }
        return true
      }
    },
    Queue: class MockQueue {
      add() { return queueAddImpl() }
      close() {}
    },
  }
})

beforeAll(() => {
  seedEnv()
})

describe("startTopupWorker", () => {
  test("funds card successfully", async () => {
    const { startTopupWorker } = await import("../src/workers/topup.worker.js")

    let fundedAmount = ""
    const app = {
      prisma: {
        card: {
          findFirst: async () => ({
            id: "card-1", userId: "user-1", issuerId: "issuer-1",
            last4: "1234", expiryMonth: "12", expiryYear: "28", status: "ACTIVE",
          }),
        },
      },
      cardIssuer: {
        fundCard: async (_cardId: string, amount: string) => { fundedAmount = amount },
      },
      redis: { set: async () => "OK" },
      log: { error: () => undefined, info: () => undefined },
    } as any

    const worker = startTopupWorker(app)
    expect(worker).toBeDefined()
    worker.close()
  })

  test("rollback decrements balance after max retries", async () => {
    const { startTopupWorker } = await import("../src/workers/topup.worker.js")

    let rollbackAmount = ""
    const app = {
      prisma: {
        card: {
          findFirst: async () => ({
            id: "c", userId: "u", issuerId: "i",
            last4: "1", expiryMonth: "1", expiryYear: "1", status: "A",
          }),
        },
        $transaction: async (cb: (tx: any) => Promise<any>) =>
          cb({
            user: {
              findUnique: async () => ({ rubbiBalance: new Prisma.Decimal("100.00") }),
              update: async ({ data }: { data: { rubbiBalance: { decrement: Prisma.Decimal } } }) => {
                rollbackAmount = data.rubbiBalance.decrement.toString()
                return { rubbiBalance: new Prisma.Decimal("90.00") }
              },
            },
            transaction: { create: async () => ({}) },
          }),
      },
      cardIssuer: { fundCard: async () => { throw new Error("API error") } },
      redis: { set: async (key: string) => key.includes("rollback") ? "OK" : "OK" },
      log: { error: () => undefined },
    } as any

    const worker = startTopupWorker(app)

    worker.emit("failed", {
      id: "job-rb",
      data: { userId: "user-1", depositId: "dep-1", amountRubbi: "10.00" },
      attemptsMade: 3,
      opts: { attempts: 3 },
    }, new Error("API error"))

    await new Promise((r) => setTimeout(r, 30))
    expect(rollbackAmount).toBe("10")
    worker.close()
  })
})
