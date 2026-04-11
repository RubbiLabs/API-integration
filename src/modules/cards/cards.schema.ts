import { z } from "zod"

export const cardActionSchema = z.object({
  reason: z.string().trim().min(1).max(140).optional(),
})
