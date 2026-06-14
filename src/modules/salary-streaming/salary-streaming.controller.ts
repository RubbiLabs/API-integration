import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import {
  createStreamBodySchema,
  disburseBodySchema,
  pauseStreamBodySchema,
  resumeStreamBodySchema,
  streamIdParamSchema,
} from "./salary-streaming.schema.js"
import {
  getFees,
  getStreamById,
  listStreams,
  verifyCreateStream,
  verifyDisburse,
  verifyPauseStream,
  verifyResumeStream,
} from "./salary-streaming.service.js"

export function buildSalaryStreamingController(app: FastifyInstance) {
  return {
    list: async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await listStreams()
      return reply.send(result)
    },

    byId: async (request: FastifyRequest, reply: FastifyReply) => {
      const { streamId } = streamIdParamSchema.parse(request.params)
      const result = await getStreamById(streamId)
      return reply.send(result)
    },

    fees: async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await getFees()
      return reply.send(result)
    },

    create: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createStreamBodySchema.parse(request.body)
      const result = await verifyCreateStream(app, request.user.sub, body.txHash)
      return reply.code(201).send(result)
    },

    pause: async (request: FastifyRequest, reply: FastifyReply) => {
      const { streamId } = streamIdParamSchema.parse(request.params)
      const body = pauseStreamBodySchema.parse(request.body)
      const result = await verifyPauseStream(app, request.user.sub, streamId, body.txHash)
      return reply.send(result)
    },

    resume: async (request: FastifyRequest, reply: FastifyReply) => {
      const { streamId } = streamIdParamSchema.parse(request.params)
      const body = resumeStreamBodySchema.parse(request.body)
      const result = await verifyResumeStream(app, request.user.sub, streamId, body.txHash)
      return reply.send(result)
    },

    disburse: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = disburseBodySchema.parse(request.body)
      const result = await verifyDisburse(app, request.user.sub, body.txHash)
      return reply.code(201).send(result)
    },
  }
}
