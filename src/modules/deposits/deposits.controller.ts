import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { getDepositByHash, listMyDeposits } from "./deposits.service.js"

const paramsSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
})

export function buildDepositsController(app: FastifyInstance) {
  return {
    list: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await listMyDeposits(app, request.user.sub)
      return reply.send(result)
    },
    byTxHash: async (request: FastifyRequest, reply: FastifyReply) => {
      const { txHash } = paramsSchema.parse(request.params)
      const result = await getDepositByHash(app, request.user.sub, txHash)
      return reply.send(result)
    },
  }
}
