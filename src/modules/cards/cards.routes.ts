import { FastifyInstance } from "fastify"

import { buildCardsController } from "./cards.controller.js"

export async function registerCardsRoutes(app: FastifyInstance) {
  const controller = buildCardsController(app)

  app.get("/cards/me", {
    onRequest: app.authenticate,
    schema: { tags: ["cards"], description: "Get current user card summary" },
    handler: controller.me,
  })

  app.post("/cards/freeze", {
    onRequest: app.authenticate,
    schema: { tags: ["cards"], description: "Freeze current user card" },
    handler: controller.freeze,
  })

  app.post("/cards/unfreeze", {
    onRequest: app.authenticate,
    schema: { tags: ["cards"], description: "Unfreeze current user card" },
    handler: controller.unfreeze,
  })

  app.get("/cards/me/number", {
    onRequest: app.authenticate,
    schema: { tags: ["cards"], description: "Reveal full PAN from issuer" },
    handler: controller.reveal,
  })
}
