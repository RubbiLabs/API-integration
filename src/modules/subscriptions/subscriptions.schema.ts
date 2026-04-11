import { z } from "zod"

const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")

export const subscriptionStartBodySchema = z.object({
  planId: z.number().int().nonnegative(),
  txHash: txHashSchema,
})

export const subscriptionActionBodySchema = z.object({
  txHash: txHashSchema,
})

export const subscriptionPlanParamSchema = z.object({
  planId: z.coerce.number().int().nonnegative(),
})

export type SubscriptionStartBody = z.infer<typeof subscriptionStartBodySchema>
export type SubscriptionActionBody = z.infer<typeof subscriptionActionBodySchema>
