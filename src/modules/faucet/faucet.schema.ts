import { z } from "zod"

export const faucetClaimBodySchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
})

export type FaucetClaimBody = z.infer<typeof faucetClaimBodySchema>
