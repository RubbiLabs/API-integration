import { FastifyInstance } from "fastify"

import { buildTransactionsController } from "./transactions.controller.js"

export async function registerTransactionsRoutes(app: FastifyInstance) {
  const controller = buildTransactionsController(app)

  app.get("/transactions", {
    preHandler: app.authenticate,
    schema: {
      tags: ["transactions"],
      description: "Get paginated ledger transactions",
    },
    handler: controller.list,
  })
}
