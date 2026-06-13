import { beforeAll, describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { makeCard, makeHttpErrors, makeUser, seedEnv } from "./helpers.js"

beforeAll(seedEnv)

describe("getMe", () => {
  test("returns user profile with card", async () => {
    const { getMe } = await import("../src/modules/users/users.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => ({
            ...makeUser(),
            rubbiBalance: new Prisma.Decimal("42.50"),
            card: makeCard(),
          }),
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    const result = await getMe(app, "0xuser000000000000000000000000000000000001")
    expect(result.walletAddress).toBe("0xuser000000000000000000000000000000000001")
    expect(result.rubbiBalance).toBe("42.5")
    expect(result.card).not.toBeNull()
    expect(result.card!.last4).toBe("1234")
  })

  test("returns user profile without card", async () => {
    const { getMe } = await import("../src/modules/users/users.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => ({
            ...makeUser(),
            card: null,
          }),
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    const result = await getMe(app, "0xuser")
    expect(result.card).toBeNull()
  })

  test("throws 404 when user not found", async () => {
    const { getMe } = await import("../src/modules/users/users.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => null,
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    await expect(getMe(app, "0xnobody")).rejects.toThrow("User not found")
  })
})
