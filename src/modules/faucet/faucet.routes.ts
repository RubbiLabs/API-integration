import { FastifyInstance } from "fastify"

import { buildFaucetController } from "./faucet.controller.js"

export async function registerFaucetRoutes(app: FastifyInstance) {
  const controller = buildFaucetController(app)

  app.post("/faucet/claim", {
    onRequest: app.authenticate,
    schema: {
      tags: ["faucet"],
      description: "Confirm a user-signed faucet claim transaction",
    },
    handler: controller.claim,
  })

  app.get("/faucet/cooldown", {
    onRequest: app.authenticate,
    schema: {
      tags: ["faucet"],
      description: "Get faucet cooldown for current wallet",
    },
    handler: controller.cooldown,
  })
}
