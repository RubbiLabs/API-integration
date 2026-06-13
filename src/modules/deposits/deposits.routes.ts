import { FastifyInstance } from "fastify"

import { buildDepositsController } from "./deposits.controller.js"

export async function registerDepositsRoutes(app: FastifyInstance) {
  const controller = buildDepositsController(app)

  app.get("/deposits", {
    onRequest: app.authenticate,
    schema: { tags: ["deposits"], description: "List user deposit history" },
    handler: controller.list,
  })

  app.get("/deposits/:txHash", {
    onRequest: app.authenticate,
    schema: { tags: ["deposits"], description: "Get deposit by transaction hash" },
    handler: controller.byTxHash,
  })
}
