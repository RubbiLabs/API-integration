import { FastifyInstance } from "fastify"

import { buildTransactionsController } from "./transactions.controller.js"

export async function registerTransactionsRoutes(app: FastifyInstance) {
  const controller = buildTransactionsController(app)

  app.get("/transactions", {
    onRequest: app.authenticate,
    schema: {
      tags: ["transactions"],
      description: "Get paginated ledger transactions",
      querystring: {
        type: "object",
        properties: {
          page: { type: "number", minimum: 1, default: 1 },
          pageSize: { type: "number", minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            page: { type: "number" },
            pageSize: { type: "number" },
            total: { type: "number" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: { type: "string" },
                  amountRubbi: { type: "string" },
                  balanceAfter: { type: "string" },
                  description: { type: "string", nullable: true },
                  metadata: { type: "object", nullable: true },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
    },
    handler: controller.list,
  })
}
