import { beforeAll, describe, expect, mock, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { makeHttpErrors, makeJwt, seedEnv } from "./helpers.js"

let mockGetUserInfo: any = null

mock.module("../src/lib/arbitrum/client.js", () => ({
  publicClient: {
    readContract: async () => mockGetUserInfo,
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

describe("registerUser", () => {
  test("registers a new user and creates card", async () => {
    mockGetUserInfo = {
      name: "0x616c696365",
      address_: "0xabc0000000000000000000000000000000000001",
    }

    const { registerUser } = await import("../src/modules/auth/auth.service.js")

    const walletAddress = "0xabc0000000000000000000000000000000000001"
    const username = "alice"

    let cardCreated = false
    const app = {
      prisma: {
        user: {
          upsert: async () => ({
            id: "user-1",
            walletAddress,
            username,
            rubbiBalance: new Prisma.Decimal(0),
            card: null,
          }),
        },
        card: {
          create: async () => {
            cardCreated = true
            return {
              id: "card-1", userId: "user-1", issuerId: "issuer-1",
              last4: "5678", expiryMonth: "12", expiryYear: "29", status: "ACTIVE",
            }
          },
        },
      },
      cardIssuer: {
        createVirtualCard: async () => ({
          id: "issuer-1", last4: "5678",
          expiryMonth: "12", expiryYear: "29", status: "ACTIVE" as const,
        }),
      },
      jwt: makeJwt(),
      httpErrors: makeHttpErrors(),
    } as any

    const result = await registerUser(app, { walletAddress, username })

    expect(result.token).toBeString()
    expect(result.user.walletAddress).toBe(walletAddress)
    expect(result.user.username).toBe(username)
    expect(cardCreated).toBeTrue()
  })

  test("rejects when wallet not on-chain", async () => {
    mockGetUserInfo = {
      name: "0x",
      address_: "0x0000000000000000000000000000000000000000",
    }

    const { registerUser } = await import("../src/modules/auth/auth.service.js")
    await expect(
      registerUser(
        { prisma: {}, cardIssuer: {}, jwt: {}, httpErrors: makeHttpErrors() } as any,
        { walletAddress: "0x0000000000000000000000000000000000000000", username: "nobody" },
      ),
    ).rejects.toThrow("Wallet is not registered on-chain")
  })
})

describe("loginUser", () => {
  test("logs in existing user and returns token", async () => {
    mockGetUserInfo = {
      name: "0x626f6200",
      address_: "0xdef0000000000000000000000000000000000001",
    }

    const { loginUser } = await import("../src/modules/auth/auth.service.js")
    const walletAddress = "0xdef0000000000000000000000000000000000001"

    let upserted = false
    const app = {
      prisma: {
        user: {
          upsert: async () => {
            upserted = true
            return { id: "user-1", walletAddress, username: "bob", rubbiBalance: new Prisma.Decimal(50) }
          },
        },
      },
      jwt: makeJwt(),
      httpErrors: makeHttpErrors(),
    } as any

    const result = await loginUser(app, { walletAddress })
    expect(result.token).toBeString()
    expect(upserted).toBeTrue()
  })
})
