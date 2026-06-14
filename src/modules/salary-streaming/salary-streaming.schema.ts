import { z } from "zod"

const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")

export const streamIdParamSchema = z.object({
  streamId: z.coerce.number().int().nonnegative(),
})

export const createStreamBodySchema = z.object({
  txHash: txHashSchema,
})

export const pauseStreamBodySchema = z.object({
  txHash: txHashSchema,
})

export const resumeStreamBodySchema = z.object({
  txHash: txHashSchema,
})

export const disburseBodySchema = z.object({
  txHash: txHashSchema,
})

export type CreateStreamBody = z.infer<typeof createStreamBodySchema>
export type PauseStreamBody = z.infer<typeof pauseStreamBodySchema>
export type ResumeStreamBody = z.infer<typeof resumeStreamBodySchema>
export type DisburseBody = z.infer<typeof disburseBodySchema>
