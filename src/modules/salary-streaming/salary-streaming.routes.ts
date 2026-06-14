import { FastifyInstance } from "fastify"

import { buildSalaryStreamingController } from "./salary-streaming.controller.js"

export async function registerSalaryStreamingRoutes(app: FastifyInstance) {
  const controller = buildSalaryStreamingController(app)

  app.get("/salary-streaming/streams", {
    onRequest: app.authenticate,
    schema: {
      tags: ["salary-streaming"],
      description: "List all daily and monthly salary streams from chain",
      response: {
        200: {
          type: "object",
          properties: {
            daily: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  recipient: { type: "string" },
                  amount: { type: "string" },
                  lastPayment: { type: "string" },
                  startTime: { type: "string" },
                  intervalType: { type: "number" },
                  active: { type: "boolean" },
                  name: { type: "string" },
                  streamOwner: { type: "string" },
                },
              },
            },
            monthly: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  recipient: { type: "string" },
                  amount: { type: "string" },
                  lastPayment: { type: "string" },
                  startTime: { type: "string" },
                  intervalType: { type: "number" },
                  active: { type: "boolean" },
                  name: { type: "string" },
                  streamOwner: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    handler: controller.list,
  })

  app.get("/salary-streaming/streams/:streamId", {
    onRequest: app.authenticate,
    schema: {
      tags: ["salary-streaming"],
      description: "Get a specific salary stream by ID",
      params: {
        type: "object",
        properties: {
          streamId: { type: "number" },
        },
        required: ["streamId"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            recipient: { type: "string" },
            amount: { type: "string" },
            lastPayment: { type: "string" },
            startTime: { type: "string" },
            intervalType: { type: "number" },
            active: { type: "boolean" },
            name: { type: "string" },
            streamOwner: { type: "string" },
          },
        },
      },
    },
    handler: controller.byId,
  })

  app.get("/salary-streaming/fees", {
    onRequest: app.authenticate,
    schema: {
      tags: ["salary-streaming"],
      description: "Get current contract streaming fees",
      response: {
        200: {
          type: "object",
          properties: {
            fees: { type: "string" },
          },
        },
      },
    },
    handler: controller.fees,
  })

  app.post("/salary-streaming/streams", {
    onRequest: app.authenticate,
    schema: {
      tags: ["salary-streaming"],
      description: "Confirm a wallet-signed createStream transaction",
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
            streamId: { type: "string", nullable: true },
            verified: { type: "boolean" },
          },
        },
      },
    },
    handler: controller.create,
  })

  app.post("/salary-streaming/streams/:streamId/pause", {
    onRequest: app.authenticate,
    schema: {
      tags: ["salary-streaming"],
      description: "Confirm a wallet-signed pause stream transaction",
      params: {
        type: "object",
        properties: {
          streamId: { type: "number" },
        },
        required: ["streamId"],
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
            streamId: { type: "number" },
            verified: { type: "boolean" },
          },
        },
      },
    },
    handler: controller.pause,
  })

  app.post("/salary-streaming/streams/:streamId/resume", {
    onRequest: app.authenticate,
    schema: {
      tags: ["salary-streaming"],
      description: "Confirm a wallet-signed resume stream transaction",
      params: {
        type: "object",
        properties: {
          streamId: { type: "number" },
        },
        required: ["streamId"],
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
            streamId: { type: "number" },
            verified: { type: "boolean" },
          },
        },
      },
    },
    handler: controller.resume,
  })

  app.post("/salary-streaming/disburse", {
    onRequest: app.authenticate,
    schema: {
      tags: ["salary-streaming"],
      description: "Confirm a wallet-signed disbursement transaction (daily or monthly)",
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
    handler: controller.disburse,
  })
}
