import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import { loginBodySchema, registerBodySchema } from "./auth.schema.js"
import { loginUser, registerUser } from "./auth.service.js"

export function buildAuthController(app: FastifyInstance) {
  return {
    register: async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const body = registerBodySchema.parse(request.body)
      const result = await registerUser(app, body)
      return reply.code(201).send(result)
    },

    login: async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const body = loginBodySchema.parse(request.body)
      const result = await loginUser(app, body)
      return reply.code(200).send(result)
    },
  }
}
