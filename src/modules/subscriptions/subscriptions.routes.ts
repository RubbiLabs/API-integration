import { FastifyInstance } from "fastify"

import { buildSubscriptionsController } from "./subscriptions.controller.js"

export async function registerSubscriptionsRoutes(app: FastifyInstance) {
  const controller = buildSubscriptionsController(app)

  app.get("/subscriptions/plans", {
    onRequest: app.authenticate,
    schema: {
      tags: ["subscriptions"],
      description: "List active plans from chain",
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            properties: {
              planId: { type: "number" },
              name: { type: "string" },
              feeRubbi: { type: "string" },
              active: { type: "boolean" },
            },
          },
        },
      },
    },
    handler: controller.plans,
  })

  app.get("/subscriptions/me", {
    onRequest: app.authenticate,
    schema: {
      tags: ["subscriptions"],
      description: "List user subscriptions from chain",
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            properties: {
              active: { type: "boolean" },
              planName: { type: "string" },
              feeRubbi: { type: "string" },
              userAddress: { type: "string" },
              planId: { type: "number" },
            },
          },
        },
      },
    },
    handler: controller.me,
  })

  app.post("/subscriptions/start", {
    onRequest: app.authenticate,
    schema: {
      tags: ["subscriptions"],
      description: "Confirm a wallet-signed start subscription transaction",
      body: {
        type: "object",
        required: ["planId", "txHash"],
        properties: {
          planId: { type: "number" },
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
    handler: controller.start,
  })

  app.post("/subscriptions/:planId/pause", {
    onRequest: app.authenticate,
    schema: {
      tags: ["subscriptions"],
      description: "Confirm a wallet-signed pause subscription transaction",
      params: {
        type: "object",
        properties: {
          planId: { type: "number" },
        },
        required: ["planId"],
      },
      body: {
        type: "object",
        required: ["txHash"],
        properties: {
          txHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            txHash: { type: "string" },
            verified: { type: "boolean" },
          },
        },
      },
    },
    handler: controller.pause,
  })

  app.post("/subscriptions/:planId/resume", {
    onRequest: app.authenticate,
    schema: {
      tags: ["subscriptions"],
      description: "Confirm a wallet-signed resume subscription transaction",
      params: {
        type: "object",
        properties: {
          planId: { type: "number" },
        },
        required: ["planId"],
      },
      body: {
        type: "object",
        required: ["txHash"],
        properties: {
          txHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            txHash: { type: "string" },
            verified: { type: "boolean" },
          },
        },
      },
    },
    handler: controller.resume,
  })
}
