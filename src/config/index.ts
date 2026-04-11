import { z } from "zod"

const hexAddress = /^0x[a-fA-F0-9]{40}$/
const hexPrivateKey = /^0x[a-fA-F0-9]{64}$/
const zeroPrivateKey = /^0x0{64}$/i

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  MONAD_RPC_URL: z.string().url(),
  MONAD_WS_URL: z.string().url().optional(),
  MONAD_CHAIN_ID: z.coerce.number().int().positive(),
  MONAD_LOG_BACKFILL_CHUNK: z.coerce.number().int().positive().default(100),

  RUBBI_TOKEN_ADDRESS: z.string().regex(hexAddress),
  MODAL_CONTRACT_ADDRESS: z.string().regex(hexAddress),
  AUTH_CONTRACT_ADDRESS: z.string().regex(hexAddress),
  SUBSCRIPTION_CONTRACT_ADDRESS: z.string().regex(hexAddress),
  SALARY_STREAMING_ADDRESS: z.string().regex(hexAddress),

  BACKEND_WALLET_PRIVATE_KEY: z.string().regex(hexPrivateKey),

  SUDO_API_KEY: z.string().min(1),
  SUDO_BASE_URL: z.string().url().default("https://api.sudo.africa/v2"),
  SUDO_WEBHOOK_SECRET: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("24h"),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === "production" && zeroPrivateKey.test(value.BACKEND_WALLET_PRIVATE_KEY)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["BACKEND_WALLET_PRIVATE_KEY"],
      message: "BACKEND_WALLET_PRIVATE_KEY cannot be the all-zero placeholder in production",
    })
  }
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n")

  throw new Error(`Invalid environment variables:\n${details}`)
}

export const env = parsed.data
