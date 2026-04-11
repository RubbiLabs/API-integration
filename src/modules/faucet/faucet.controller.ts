import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import { claimFaucet, faucetCooldown } from "./faucet.service.js"
import { faucetClaimBodySchema } from "./faucet.schema.js"

export function buildFaucetController(app: FastifyInstance) {
  return {
    claim: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = faucetClaimBodySchema.parse(request.body)
      const result = await claimFaucet(app, request.user.sub, body.txHash)
      return reply.code(201).send(result)
    },
    cooldown: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await faucetCooldown(request.user.sub)
      return reply.send(result)
    },
  }
}
