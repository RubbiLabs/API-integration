import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { listMyTransactions } from "./transactions.service.js"

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export function buildTransactionsController(app: FastifyInstance) {
  return {
    list: async (request: FastifyRequest, reply: FastifyReply) => {
      const query = querySchema.parse(request.query)
      const result = await listMyTransactions(app, request.user.sub, query)
      return reply.send(result)
    },
  }
}
