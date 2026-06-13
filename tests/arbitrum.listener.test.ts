import { beforeAll, describe, expect, mock, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { seedEnv } from "./helpers.js"

// Mutable closures so each test can set the mock behavior it needs
let depositAddImpl = async () => {}
let redisSetImpl = async () => "OK"
let redisGetImpl = async () => null

const MockRedisClass = class MockRedis {
  on() { return this }
  quit() { return Promise.resolve() }
}
mock.module("ioredis", () => ({
  default: MockRedisClass,
  Redis: MockRedisClass,
}))

mock.module("bullmq", () => ({
  Worker: class MockWorker {
    constructor() {}
    on() { return this }
    close() {}
    emit() { return true }
  },
  Queue: class MockQueue {
    add() { return depositAddImpl() }
    close() {}
  },
}))

mock.module("../src/lib/arbitrum/client.js", () => ({
  publicClient: {} as any,
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

beforeAll(seedEnv)

describe("handleDepositLogs", () => {
  test("processes deposit logs and enqueues jobs", async () => {
    const { handleDepositLogs } = await import("../src/listeners/arbitrum.listener.js")

    let queued = false
    depositAddImpl = async () => { queued = true }
    redisSetImpl = async () => "OK"

    const app = {
      redis: { get: async () => null, set: redisSetImpl },
      prisma: {},
      log: { info: () => undefined },
    } as any

    await handleDepositLogs(app, [
      {
        args: { user: "0xabc0000000000000000000000000000000000001", _amount: 1000000000000000000n },
        transactionHash: "0xaaa",
        logIndex: 0n,
        blockNumber: 1000n,
      },
    ])

    expect(queued).toBeTrue()
  })

  test("skips deposit log with missing fields", async () => {
    const { handleDepositLogs } = await import("../src/listeners/arbitrum.listener.js")

    let queued = false
    depositAddImpl = async () => { queued = true }

    const app = {
      redis: { get: async () => null, set: async () => "OK" },
      prisma: {},
      log: { info: () => undefined },
    } as any

    await handleDepositLogs(app, [
      { args: {} as Record<string, unknown>, transactionHash: undefined, logIndex: undefined, blockNumber: undefined },
    ])

    expect(queued).toBeFalse()
  })

  test("deduplicates deposit logs via Redis lock", async () => {
    const { handleDepositLogs } = await import("../src/listeners/arbitrum.listener.js")

    let queueCalls = 0
    depositAddImpl = async () => { queueCalls++ }
    redisSetImpl = async () => null

    const app = {
      redis: { get: async () => null, set: redisSetImpl },
      prisma: {},
      log: { info: () => undefined },
    } as any

    await handleDepositLogs(app, [
      {
        args: { user: "0xabc", _amount: 1n },
        transactionHash: "0xdup",
        logIndex: 0n,
        blockNumber: 100n,
      },
    ])

    expect(queueCalls).toBe(0)
  })
})

describe("handleWithdrawalLogs", () => {
  test("decrements balance for confirmed withdrawals", async () => {
    const { handleWithdrawalLogs } = await import("../src/listeners/arbitrum.listener.js")

    let balanceChanged = false
    const app = {
      redis: { set: async () => "OK", get: async () => null },
      prisma: {
        user: {
          findUnique: async () => ({
            id: "user-1",
            rubbiBalance: new Prisma.Decimal("100.00"),
          }),
        },
        $transaction: async (cb: (tx: any) => Promise<any>) =>
          cb({
            user: {
              update: async () => {
                balanceChanged = true
                return { rubbiBalance: new Prisma.Decimal("90.00") }
              },
            },
            transaction: { create: async () => ({}) },
          }),
      },
      log: { info: () => undefined, warn: () => undefined },
    } as any

    await handleWithdrawalLogs(app, [
      {
        args: { user: "0xabc", _amount: BigInt("10000000000000000000") },
        transactionHash: "0xbbb",
        logIndex: 0n,
        blockNumber: 1001n,
      },
    ])

    expect(balanceChanged).toBeTrue()
  })

  test("skips withdrawal when local balance insufficient", async () => {
    const { handleWithdrawalLogs } = await import("../src/listeners/arbitrum.listener.js")

    let balanceChanged = false
    const app = {
      redis: { set: async () => "OK", get: async () => null },
      prisma: {
        user: {
          findUnique: async () => ({
            id: "user-1",
            rubbiBalance: new Prisma.Decimal("1.00"),
          }),
        },
        $transaction: async () => { balanceChanged = true },
      },
      log: { info: () => undefined, warn: () => undefined },
    } as any

    await handleWithdrawalLogs(app, [
      {
        args: { user: "0xabc", _amount: BigInt("100000000000000000000") },
        transactionHash: "0xbbb",
      },
    ])

    expect(balanceChanged).toBeFalse()
  })
})

describe("handleMemberEnrolledLogs", () => {
  test("upserts user from enrollment event", async () => {
    const { handleMemberEnrolledLogs } = await import("../src/listeners/arbitrum.listener.js")

    let upsertArgs: Record<string, unknown> = {}
    const app = {
      redis: { set: async () => "OK", get: async () => null },
      prisma: {
        user: {
          upsert: async ({ where, create }: { where: Record<string, unknown>; create: Record<string, unknown> }) => {
            upsertArgs = { where, create }
            return {}
          },
        },
      },
      log: { info: () => undefined },
    } as any

    await handleMemberEnrolledLogs(app, [
      {
        args: { _address: "0xabc0000000000000000000000000000000000001", name: "0x616c696365" },
        blockNumber: 100n,
      },
    ])

    expect(upsertArgs.where).toEqual({ walletAddress: "0xabc0000000000000000000000000000000000001" })
    expect((upsertArgs.create as Record<string, unknown>).username).toBe("alice")
  })
})

describe("handleSubscriptionStartedLogs", () => {
  test("creates local subscription from on-chain event", async () => {
    const { handleSubscriptionStartedLogs } = await import("../src/listeners/arbitrum.listener.js")

    let upsertCalled = false
    const app = {
      redis: { set: async () => "OK", get: async () => null },
      prisma: {
        user: { findUnique: async () => ({ id: "user-1" }) },
        subscription: { upsert: async () => { upsertCalled = true } },
      },
      log: { info: () => undefined },
    } as any

    await handleSubscriptionStartedLogs(app, [
      { args: { subscriber: "0xabc", planId: 1n }, blockNumber: 200n },
    ])

    expect(upsertCalled).toBeTrue()
  })
})

describe("handleSubscriptionPaidLogs", () => {
  test("decrements balance when subscription payment detected", async () => {
    const { handleSubscriptionPaidLogs } = await import("../src/listeners/arbitrum.listener.js")

    let decremented = false
    const app = {
      redis: { set: async () => "OK", get: async () => null },
      prisma: {
        user: {
          findUnique: async () => ({
            id: "user-1",
            rubbiBalance: new Prisma.Decimal("100.00"),
          }),
        },
        $transaction: async (cb: (tx: any) => Promise<any>) =>
          cb({
            user: { update: async () => { decremented = true; return { rubbiBalance: new Prisma.Decimal("85.00") } } },
            transaction: { create: async () => ({}) },
          }),
      },
      log: { info: () => undefined },
    } as any

    await handleSubscriptionPaidLogs(app, [
      {
        args: { from: "0xabc", to: "0xdef", fee: BigInt("15000000000000000000") },
        transactionHash: "0xfee1", logIndex: 0n, blockNumber: 300n,
      },
    ])

    expect(decremented).toBeTrue()
  })
})

describe("handleSubscriptionPausedLogs", () => {
  test("updates local subscription to PAUSED", async () => {
    const { handleSubscriptionPausedLogs } = await import("../src/listeners/arbitrum.listener.js")

    let updated = false
    const app = {
      redis: { set: async () => "OK", get: async () => null },
      prisma: {
        user: { findUnique: async () => ({ id: "user-1" }) },
        subscription: { updateMany: async () => { updated = true; return { count: 1 } } },
      },
      log: { info: () => undefined },
    } as any

    await handleSubscriptionPausedLogs(app, [
      { args: { subscriber: "0xabc", planId: 1n }, blockNumber: 400n },
    ])

    expect(updated).toBeTrue()
  })
})

describe("handleSubscriptionResumedLogs", () => {
  test("updates local subscription to ACTIVE", async () => {
    const { handleSubscriptionResumedLogs } = await import("../src/listeners/arbitrum.listener.js")

    let updated = false
    const app = {
      redis: { set: async () => "OK", get: async () => null },
      prisma: {
        user: { findUnique: async () => ({ id: "user-1" }) },
        subscription: { updateMany: async () => { updated = true; return { count: 1 } } },
      },
      log: { info: () => undefined },
    } as any

    await handleSubscriptionResumedLogs(app, [
      { args: { subscriber: "0xabc", planId: 1n }, blockNumber: 500n },
    ])

    expect(updated).toBeTrue()
  })
})

describe("handleFaucetClaimedLogs", () => {
  test("increments balance on faucet claim", async () => {
    const { handleFaucetClaimedLogs } = await import("../src/listeners/arbitrum.listener.js")

    let incremented = false
    const app = {
      redis: { set: async () => "OK", get: async () => null },
      prisma: {
        user: { findUnique: async () => ({ id: "user-1" }) },
        $transaction: async (cb: (tx: any) => Promise<any>) =>
          cb({
            user: { update: async () => { incremented = true; return { rubbiBalance: new Prisma.Decimal("1100.00") } } },
            transaction: { create: async () => ({}) },
          }),
      },
      log: { info: () => undefined },
    } as any

    await handleFaucetClaimedLogs(app, [
      {
        args: { claimer: "0xabc", amount: BigInt("1000000000000000000000") },
        transactionHash: "0xfacu", blockNumber: 600n,
      },
    ])

    expect(incremented).toBeTrue()
  })
})
