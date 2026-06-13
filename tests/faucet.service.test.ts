import { beforeAll, describe, expect, mock, test } from "bun:test"
import { seedEnv } from "./helpers.js"

mock.module("../src/lib/arbitrum/client.js", () => ({
  publicClient: {
    readContract: async () => 1000000n,
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

beforeAll(seedEnv)

describe("faucetCooldown", () => {
  test("returns cooldown seconds from on-chain contract", async () => {
    const { faucetCooldown } = await import("../src/modules/faucet/faucet.service.js")

    const result = await faucetCooldown("0xabc0000000000000000000000000000000000001")
    expect(result.walletAddress).toBe("0xabc0000000000000000000000000000000000001")
    expect(result.cooldownSeconds).toBeNumber()
  })
})
