import { FastifyInstance } from "fastify"

import { handleCardIssuerWebhook } from "./webhooks.service.js"

export async function registerWebhooksRoutes(app: FastifyInstance) {
  await app.register(async (webhooks) => {
    webhooks.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_request, body, done) => {
        done(null, body)
      },
    )

    webhooks.post("/webhooks/card-issuer", {
      config: {
        rateLimit: { max: 600, timeWindow: "1 minute" },
      },
      schema: {
        tags: ["webhooks"],
        description: "Card issuer webhook endpoint with HMAC verification",
        headers: {
          type: "object",
          properties: {
            "x-sudo-signature": { type: "string" },
            "x-signature": { type: "string" },
          },
        },
        body: {
          type: "object",
        },
        response: {
          200: {
            type: "object",
            properties: {
              statusCode: { type: "number" },
              data: {
                type: "object",
                properties: {
                  responseCode: { type: "string" },
                },
              },
              ok: { type: "boolean" },
              ignored: { type: "boolean" },
              duplicate: { type: "boolean" },
              reason: { type: "string" },
            },
          },
        },
      },
      handler: async (request, reply) => {
        const rawBody = request.body as string
        let parsedBody: object

        try {
          parsedBody = JSON.parse(rawBody) as object
        } catch {
          throw app.httpErrors.badRequest("Invalid JSON payload")
        }

        const header =
          request.headers["x-sudo-signature"] ??
          request.headers["x-signature"]

        const signature = Array.isArray(header) ? header[0] : header

        const result = await handleCardIssuerWebhook(
          app,
          parsedBody,
          signature,
          rawBody,
        )

        return reply.send(result)
      },
    })
  })
}
