import { beforeAll, describe, expect, test } from "bun:test"
import { makeDeposit, makeHttpErrors, makeUser, seedEnv } from "./helpers.js"

beforeAll(seedEnv)

describe("listMyDeposits", () => {
  test("returns deposits for authenticated user", async () => {
    const { listMyDeposits } = await import("../src/modules/deposits/deposits.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => makeUser(),
        },
        deposit: {
          findMany: async () => [
            makeDeposit({ txHash: "0xaaa", amountRaw: "10000000000000000000", amountRubbi: new (await import("@prisma/client")).Prisma.Decimal("10.00") }),
            makeDeposit({ id: "deposit-2", txHash: "0xbbb", amountRaw: "20000000000000000000", amountRubbi: new (await import("@prisma/client")).Prisma.Decimal("20.00") }),
          ],
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    const result = await listMyDeposits(app, "0xuser000000000000000000000000000000000001")
    expect(result).toHaveLength(2)
    expect(result[0].txHash).toBe("0xaaa")
    expect(result[1].txHash).toBe("0xbbb")
  })

  test("throws 404 when user not found", async () => {
    const { listMyDeposits } = await import("../src/modules/deposits/deposits.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => null,
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    await expect(listMyDeposits(app, "0xnobody")).rejects.toThrow("User not found")
  })
})

describe("getDepositByHash", () => {
  test("returns deposit matching tx hash", async () => {
    const { getDepositByHash } = await import("../src/modules/deposits/deposits.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => makeUser(),
        },
        deposit: {
          findFirst: async () => makeDeposit({ txHash: "0xaaa" }),
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    const result = await getDepositByHash(app, "0xuser", "0xaaa")
    expect(result.txHash).toBe("0xaaa")
  })

  test("throws 404 when deposit not found", async () => {
    const { getDepositByHash } = await import("../src/modules/deposits/deposits.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => makeUser(),
        },
        deposit: {
          findFirst: async () => null,
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    await expect(
      getDepositByHash(app, "0xuser", "0xnonexistent"),
    ).rejects.toThrow("Deposit not found")
  })
})
