import { FastifyInstance } from "fastify"

import { handleCardIssuerWebhook } from "./webhooks.service.js"

export async function registerWebhooksRoutes(app: FastifyInstance) {
  app.post("/webhooks/card-issuer", {
    config: {
      rateLimit: { max: 600, timeWindow: "1 minute" },
    },
    schema: {
      tags: ["webhooks"],
      description: "Card issuer webhook endpoint with HMAC verification",
    },
    handler: async (request, reply) => {
      const signature = request.headers["x-sudo-signature"] as string | undefined
      const result = await handleCardIssuerWebhook(app, request.body as object, signature)
      return reply.send(result)
    },
  })
}
