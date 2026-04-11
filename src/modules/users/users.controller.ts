import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import { getMe } from "./users.service.js"

export function buildUsersController(app: FastifyInstance) {
  return {
    me: async (request: FastifyRequest, reply: FastifyReply) => {
      const walletAddress = request.user.sub
      const result = await getMe(app, walletAddress)
      return reply.send(result)
    },
  }
}
