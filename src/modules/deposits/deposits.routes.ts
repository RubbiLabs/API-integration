import { FastifyInstance } from "fastify"

import { buildDepositsController } from "./deposits.controller.js"

export async function registerDepositsRoutes(app: FastifyInstance) {
  const controller = buildDepositsController(app)

  app.get("/deposits", {
    onRequest: app.authenticate,
    schema: {
      tags: ["deposits"],
      description: "List user deposit history",
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              txHash: { type: "string" },
              amountRaw: { type: "string" },
              amountRubbi: { type: "string" },
              status: { type: "string" },
              blockNumber: { type: "string" },
              confirmedAt: { type: "string", nullable: true, format: "date-time" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    handler: controller.list,
  })

  app.get("/deposits/:txHash", {
    onRequest: app.authenticate,
    schema: {
      tags: ["deposits"],
      description: "Get deposit by transaction hash",
      params: {
        type: "object",
        properties: {
          txHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
        },
        required: ["txHash"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            txHash: { type: "string" },
            amountRaw: { type: "string" },
            amountRubbi: { type: "string" },
            status: { type: "string" },
            blockNumber: { type: "string" },
            confirmedAt: { type: "string", nullable: true, format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        404: {
          type: "object",
          properties: {
            statusCode: { type: "number" },
            error: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
    handler: controller.byTxHash,
  })
}
