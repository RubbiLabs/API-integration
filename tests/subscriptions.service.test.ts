import { beforeAll, describe, expect, mock, test } from "bun:test"
import { makeHttpErrors, seedEnv } from "./helpers.js"

// Use mutable closures so each test can set the exact return value it needs
let mockTxReceipt: any = { blockNumber: BigInt(100), transactionHash: "0x0", logs: [] }
let mockReadContract: any = []

mock.module("../src/lib/arbitrum/client.js", () => ({
  publicClient: {
    waitForTransactionReceipt: async () => mockTxReceipt,
    readContract: async () => mockReadContract,
    getBlock: async () => ({ number: BigInt(200) }),
  },
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

describe("listPlans", () => {
  test("returns parsed subscription plans", async () => {
    mockReadContract = [
      { name: "Basic", fee: BigInt(100), active: true },
      { name: "Premium", fee: BigInt(200), active: true },
      { name: "Retired", fee: BigInt(0), active: false },
    ]
    const { listPlans } = await import("../src/modules/subscriptions/subscriptions.service.js")
    const plans = await listPlans()
    expect(Array.isArray(plans)).toBeTrue()
  })
})

describe("startSubscription", () => {
  test("rejects when no matching event in transaction logs", async () => {
    mockTxReceipt = { blockNumber: BigInt(100), transactionHash: "0x0", logs: [] }
    const { startSubscription } = await import("../src/modules/subscriptions/subscriptions.service.js")

    const app = {
      prisma: {
        user: { findUnique: async () => ({ id: "user-1" }) },
        subscription: { upsert: async () => ({}) },
      },
      httpErrors: makeHttpErrors(),
    } as any

    await expect(
      startSubscription(app, "0xabc0000000000000000000000000000000000001", 0, "0x0000000000000000000000000000000000000001"),
    ).rejects.toThrow("Transaction does not contain SubscriptionStarted")
  })
})

describe("pauseSubscription", () => {
  test("rejects when no matching event in transaction logs", async () => {
    mockTxReceipt = { blockNumber: BigInt(100), transactionHash: "0x0", logs: [] }
    const { pauseSubscription } = await import("../src/modules/subscriptions/subscriptions.service.js")

    const app = {
      prisma: {
        user: { findUnique: async () => ({ id: "user-1" }) },
        subscription: { updateMany: async () => ({ count: 1 }) },
      },
      httpErrors: makeHttpErrors(),
    } as any

    await expect(
      pauseSubscription(app, "0xabc0000000000000000000000000000000000001", 0, "0x0000000000000000000000000000000000000001"),
    ).rejects.toThrow("Transaction does not contain SubscriptionPaused")
  })
})

describe("resumeSubscription", () => {
  test("rejects when no matching event in transaction logs", async () => {
    mockTxReceipt = { blockNumber: BigInt(100), transactionHash: "0x0", logs: [] }
    const { resumeSubscription } = await import("../src/modules/subscriptions/subscriptions.service.js")

    const app = {
      prisma: {
        user: { findUnique: async () => ({ id: "user-1" }) },
        subscription: { updateMany: async () => ({ count: 1 }) },
      },
      httpErrors: makeHttpErrors(),
    } as any

    await expect(
      resumeSubscription(app, "0xabc0000000000000000000000000000000000001", 0, "0x0000000000000000000000000000000000000001"),
    ).rejects.toThrow("Transaction does not contain SubscriptionResumed")
  })
})
