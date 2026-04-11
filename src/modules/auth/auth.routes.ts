import { FastifyInstance } from "fastify"

import { buildAuthController } from "./auth.controller.js"

export async function registerAuthRoutes(app: FastifyInstance) {
  const controller = buildAuthController(app)

  app.post("/auth/register", {
    schema: {
      tags: ["auth"],
      description: "Register wallet on-chain and create local user/card",
    },
    handler: controller.register,
  })

  app.post("/auth/login", {
    schema: {
      tags: ["auth"],
      description: "Login with wallet by checking on-chain registration",
    },
    handler: controller.login,
  })
}
