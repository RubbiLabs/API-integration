import { FastifyInstance } from "fastify"

import { buildFaucetController } from "./faucet.controller.js"

export async function registerFaucetRoutes(app: FastifyInstance) {
  const controller = buildFaucetController(app)

  app.post("/faucet/claim", {
    onRequest: app.authenticate,
    schema: {
      tags: ["faucet"],
      description: "Confirm a user-signed faucet claim transaction",
      body: {
        type: "object",
        required: ["txHash"],
        properties: {
          txHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
        },
      },
      response: {
        201: {
          type: "object",
          properties: {
            txHash: { type: "string" },
            verified: { type: "boolean" },
          },
        },
      },
    },
    handler: controller.claim,
  })

  app.get("/faucet/cooldown", {
    onRequest: app.authenticate,
    schema: {
      tags: ["faucet"],
      description: "Get faucet cooldown for current wallet",
      response: {
        200: {
          type: "object",
          properties: {
            walletAddress: { type: "string" },
            cooldownSeconds: { type: "number" },
          },
        },
      },
    },
    handler: controller.cooldown,
  })
}
