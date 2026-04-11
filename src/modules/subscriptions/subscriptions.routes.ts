import { FastifyInstance } from "fastify"

import { buildSubscriptionsController } from "./subscriptions.controller.js"

export async function registerSubscriptionsRoutes(app: FastifyInstance) {
  const controller = buildSubscriptionsController(app)

  app.get("/subscriptions/plans", {
    preHandler: app.authenticate,
    schema: { tags: ["subscriptions"], description: "List active plans from chain" },
    handler: controller.plans,
  })

  app.get("/subscriptions/me", {
    preHandler: app.authenticate,
    schema: { tags: ["subscriptions"], description: "List user subscriptions from chain" },
    handler: controller.me,
  })

  app.post("/subscriptions/start", {
    preHandler: app.authenticate,
    schema: {
      tags: ["subscriptions"],
      description: "Confirm a wallet-signed start subscription transaction",
    },
    handler: controller.start,
  })

  app.post("/subscriptions/:planId/pause", {
    preHandler: app.authenticate,
    schema: {
      tags: ["subscriptions"],
      description: "Confirm a wallet-signed pause subscription transaction",
    },
    handler: controller.pause,
  })

  app.post("/subscriptions/:planId/resume", {
    preHandler: app.authenticate,
    schema: {
      tags: ["subscriptions"],
      description: "Confirm a wallet-signed resume subscription transaction",
    },
    handler: controller.resume,
  })
}
