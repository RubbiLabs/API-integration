import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { TEST_ENV } from "./helpers.js"

const ENV_BACKUP = { ...process.env }
let counter = 0

beforeEach(() => {
  Object.assign(process.env, TEST_ENV)
})

afterEach(() => {
  // Restore env without replacing the reference (keeps other test files' references valid)
  for (const key of Object.keys(process.env)) {
    delete process.env[key]
  }
  Object.assign(process.env, ENV_BACKUP)
})

describe("environment config validation", () => {
  test("accepts valid env vars", async () => {
    counter++
    const { env } = await import("../src/config/index.js?v=" + counter)
    expect(env.ARBITRUM_RPC_URL).toBe(TEST_ENV.ARBITRUM_RPC_URL)
    expect(env.ARBITRUM_CHAIN_ID).toBe(42161)
    expect(env.ARBITRUM_SETTLEMENT_TAG).toBe("safe")
    expect(env.PORT).toBe(3000)
  })

  test("rejects missing ARBITRUM_RPC_URL", async () => {
    delete process.env.ARBITRUM_RPC_URL
    counter++
    await expect(import("../src/config/index.js?v=" + counter)).rejects.toThrow("Invalid environment variables")
  })

  test("rejects invalid ARBITRUM_CHAIN_ID", async () => {
    process.env.ARBITRUM_CHAIN_ID = "abc"
    counter++
    await expect(import("../src/config/index.js?v=" + counter)).rejects.toThrow("Invalid environment variables")
  })

  test("rejects invalid RUBBI_TOKEN_ADDRESS format", async () => {
    process.env.RUBBI_TOKEN_ADDRESS = "not-an-address"
    counter++
    await expect(import("../src/config/index.js?v=" + counter)).rejects.toThrow("Invalid environment variables")
  })

  test("rejects short JWT_SECRET", async () => {
    process.env.JWT_SECRET = "short"
    counter++
    await expect(import("../src/config/index.js?v=" + counter)).rejects.toThrow("Invalid environment variables")
  })

  test("rejects zero private key in production", async () => {
    process.env.NODE_ENV = "production"
    process.env.BACKEND_WALLET_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000000"
    counter++
    await expect(import("../src/config/index.js?v=" + counter)).rejects.toThrow("BACKEND_WALLET_PRIVATE_KEY cannot be the all-zero placeholder")
  })

  test("rejects invalid ARBITRUM_SETTLEMENT_TAG", async () => {
    process.env.ARBITRUM_SETTLEMENT_TAG = "invalid"
    counter++
    await expect(import("../src/config/index.js?v=" + counter)).rejects.toThrow("Invalid environment variables")
  })
})
