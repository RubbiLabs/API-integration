import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import {
  listMySubscriptions,
  listPlans,
  pauseSubscription,
  resumeSubscription,
  startSubscription,
} from "./subscriptions.service.js"
import {
  subscriptionActionBodySchema,
  subscriptionPlanParamSchema,
  subscriptionStartBodySchema,
} from "./subscriptions.schema.js"

export function buildSubscriptionsController(app: FastifyInstance) {
  return {
    plans: async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await listPlans()
      return reply.send(result)
    },
    me: async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await listMySubscriptions(app, request.user.sub)
      return reply.send(result)
    },
    start: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = subscriptionStartBodySchema.parse(request.body)
      const result = await startSubscription(
        app,
        request.user.sub,
        body.planId,
        body.txHash,
      )
      return reply.code(201).send(result)
    },
    pause: async (request: FastifyRequest, reply: FastifyReply) => {
      const { planId } = subscriptionPlanParamSchema.parse(request.params)
      const body = subscriptionActionBodySchema.parse(request.body)
      const result = await pauseSubscription(app, request.user.sub, planId, body.txHash)
      return reply.send(result)
    },
    resume: async (request: FastifyRequest, reply: FastifyReply) => {
      const { planId } = subscriptionPlanParamSchema.parse(request.params)
      const body = subscriptionActionBodySchema.parse(request.body)
      const result = await resumeSubscription(app, request.user.sub, planId, body.txHash)
      return reply.send(result)
    },
  }
}
