import { FastifyInstance } from "fastify"

import { buildCardsController } from "./cards.controller.js"

export async function registerCardsRoutes(app: FastifyInstance) {
  const controller = buildCardsController(app)

  app.get("/cards/me", {
    onRequest: app.authenticate,
    schema: {
      tags: ["cards"],
      description: "Get current user card summary",
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            issuerId: { type: "string" },
            last4: { type: "string" },
            expiryMonth: { type: "number" },
            expiryYear: { type: "number" },
            status: { type: "string" },
            rubbiBalance: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            statusCode: { type: "number" },
            error: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
    handler: controller.me,
  })

  app.post("/cards/freeze", {
    onRequest: app.authenticate,
    schema: {
      tags: ["cards"],
      description: "Freeze current user card",
      body: {
        type: "object",
        properties: {
          reason: { type: "string", minLength: 1, maxLength: 140 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
          },
        },
      },
    },
    handler: controller.freeze,
  })

  app.post("/cards/unfreeze", {
    onRequest: app.authenticate,
    schema: {
      tags: ["cards"],
      description: "Unfreeze current user card",
      body: {
        type: "object",
        properties: {
          reason: { type: "string", minLength: 1, maxLength: 140 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
          },
        },
      },
    },
    handler: controller.unfreeze,
  })

  app.get("/cards/me/number", {
    onRequest: app.authenticate,
    schema: {
      tags: ["cards"],
      description: "Reveal full PAN from issuer",
      response: {
        200: {
          type: "object",
          properties: {
            cardId: { type: "string" },
            pan: { type: "string", nullable: true },
            last4: { type: "string" },
            expiryMonth: { type: "number" },
            expiryYear: { type: "number" },
            status: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            statusCode: { type: "number" },
            error: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
    handler: controller.reveal,
  })
}
