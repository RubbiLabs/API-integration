import { beforeAll, describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { makeCard, makeHttpErrors, makeUser, seedEnv } from "./helpers.js"

beforeAll(seedEnv)

describe("getMyCard", () => {
  test("returns card for user with existing card", async () => {
    const { getMyCard } = await import("../src/modules/cards/cards.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => ({
            ...makeUser(),
            card: makeCard(),
          }),
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    const result = await getMyCard(app, "0xuser000000000000000000000000000000000001")
    expect(result.issuerId).toBe("issuer-card-1")
    expect(result.last4).toBe("1234")
    expect(result.status).toBe("ACTIVE")
  })

  test("throws 404 when user or card not found", async () => {
    const { getMyCard } = await import("../src/modules/cards/cards.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => null,
        },
      },
      httpErrors: makeHttpErrors(),
    } as any

    await expect(getMyCard(app, "0xnobody00000000000000000000000000000000000")).rejects.toThrow("Card not found")
  })
})

describe("freezeMyCard", () => {
  test("freezes card via issuer and updates DB", async () => {
    const { freezeMyCard } = await import("../src/modules/cards/cards.service.js")

    let dbStatus = ""
    const app = {
      prisma: {
        user: {
          findUnique: async () => ({
            ...makeUser(),
            card: makeCard(),
          }),
        },
        card: {
          update: async ({ data }: { data: { status: string } }) => {
            dbStatus = data.status
          },
        },
      },
      cardIssuer: {
        freezeCard: async () => undefined,
      },
      httpErrors: makeHttpErrors(),
    } as any

    const result = await freezeMyCard(app, "0xuser000000000000000000000000000000000001")
    expect(result).toEqual({ status: "frozen" })
    expect(dbStatus).toBe("FROZEN")
  })
})

describe("unfreezeMyCard", () => {
  test("unfreezes card via issuer and updates DB", async () => {
    const { unfreezeMyCard } = await import("../src/modules/cards/cards.service.js")

    let dbStatus = ""
    const app = {
      prisma: {
        user: {
          findUnique: async () => ({
            ...makeUser(),
            card: makeCard({ status: "FROZEN" }),
          }),
        },
        card: {
          update: async ({ data }: { data: { status: string } }) => {
            dbStatus = data.status
          },
        },
      },
      cardIssuer: {
        unfreezeCard: async () => undefined,
      },
      httpErrors: makeHttpErrors(),
    } as any

    const result = await unfreezeMyCard(app, "0xuser000000000000000000000000000000000001")
    expect(result).toEqual({ status: "active" })
    expect(dbStatus).toBe("ACTIVE")
  })
})

describe("revealMyCardNumber", () => {
  test("returns card PAN from issuer", async () => {
    const { revealMyCardNumber } = await import("../src/modules/cards/cards.service.js")

    const app = {
      prisma: {
        user: {
          findUnique: async () => ({
            ...makeUser(),
            card: makeCard(),
          }),
        },
      },
      cardIssuer: {
        getCardDetails: async () => ({
          id: "issuer-card-1",
          last4: "1234",
          expiryMonth: "12",
          expiryYear: "28",
          status: "ACTIVE" as const,
          pan: "4111111111111234",
        }),
      },
      httpErrors: makeHttpErrors(),
    } as any

    const result = await revealMyCardNumber(app, "0xuser000000000000000000000000000000000001")
    expect(result.pan).toBe("4111111111111234")
    expect(result.last4).toBe("1234")
  })
})
