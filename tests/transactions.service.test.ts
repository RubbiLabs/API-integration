import { beforeAll, describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { makeHttpErrors, makeTx, makeUser, seedEnv } from "./helpers.js"

beforeAll(seedEnv)

describe("listMyTransactions", () => {
  test("returns paginated transactions for user", async () => {
    const { listMyTransactions } = await import("../src/modules/transactions/transactions.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => makeUser(),
        },
        transaction: {
          findMany: async () => [
            makeTx({ id: "txn-1", type: "DEPOSIT", amountRubbi: new Prisma.Decimal("50.00"), balanceAfter: new Prisma.Decimal("150.00") }),
            makeTx({ id: "txn-2", type: "SPEND", amountRubbi: new Prisma.Decimal("-25.00"), balanceAfter: new Prisma.Decimal("125.00") }),
            makeTx({ id: "txn-3", type: "SUBSCRIPTION_PAYMENT", amountRubbi: new Prisma.Decimal("-15.00"), balanceAfter: new Prisma.Decimal("110.00") }),
          ],
          count: async () => 3,
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    const result = await listMyTransactions(app, "0xuser", { page: 1, pageSize: 20 })
    expect(result.total).toBe(3)
    expect(result.items).toHaveLength(3)
    expect(result.items[0].type).toBe("DEPOSIT")
    expect(result.items[1].type).toBe("SPEND")
  })

  test("respects pagination parameters", async () => {
    const { listMyTransactions } = await import("../src/modules/transactions/transactions.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => makeUser(),
        },
        transaction: {
          findMany: async ({ skip, take }: { skip: number; take: number }) => {
            expect(skip).toBe(20)
            expect(take).toBe(10)
            return []
          },
          count: async () => 0,
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    await listMyTransactions(app, "0xuser", { page: 3, pageSize: 10 })
  })

  test("clamps page size to max 100", async () => {
    const { listMyTransactions } = await import("../src/modules/transactions/transactions.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => makeUser(),
        },
        transaction: {
          findMany: async ({ take }: { take: number }) => {
            expect(take).toBe(100)
            return []
          },
          count: async () => 0,
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    await listMyTransactions(app, "0xuser", { page: 1, pageSize: 999 })
  })
})
