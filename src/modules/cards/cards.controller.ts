import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import { cardActionSchema } from "./cards.schema.js"
import {
  freezeMyCard,
  getMyCard,
  revealMyCardNumber,
  unfreezeMyCard,
} from "./cards.service.js"

export function buildCardsController(app: FastifyInstance) {
  return {
    me: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await getMyCard(app, request.user.sub)
      return reply.send(result)
    },
    freeze: async (request: FastifyRequest, reply: FastifyReply) => {
      cardActionSchema.parse(request.body)
      const result = await freezeMyCard(app, request.user.sub)
      return reply.send(result)
    },
    unfreeze: async (request: FastifyRequest, reply: FastifyReply) => {
      cardActionSchema.parse(request.body)
      const result = await unfreezeMyCard(app, request.user.sub)
      return reply.send(result)
    },
    reveal: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await revealMyCardNumber(app, request.user.sub)
      return reply.send(result)
    },
  }
}
