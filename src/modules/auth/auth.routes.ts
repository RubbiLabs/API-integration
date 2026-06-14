import { FastifyInstance } from "fastify"

import { buildAuthController } from "./auth.controller.js"

export async function registerAuthRoutes(app: FastifyInstance) {
  const controller = buildAuthController(app)

  app.post("/auth/register", {
    schema: {
      tags: ["auth"],
      description: "Register wallet on-chain and create local user/card",
      body: {
        type: "object",
        required: ["walletAddress", "username"],
        properties: {
          walletAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
          username: { type: "string", minLength: 3, maxLength: 32, pattern: "^[a-zA-Z0-9_]+$" },
        },
      },
      response: {
        201: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                walletAddress: { type: "string" },
                username: { type: "string" },
                rubbiBalance: { type: "string" },
              },
            },
          },
        },
      },
    },
    handler: controller.register,
  })

  app.post("/auth/login", {
    schema: {
      tags: ["auth"],
      description: "Login with wallet by checking on-chain registration",
      body: {
        type: "object",
        required: ["walletAddress"],
        properties: {
          walletAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                walletAddress: { type: "string" },
                username: { type: "string", nullable: true },
                rubbiBalance: { type: "string" },
              },
            },
          },
        },
      },
    },
    handler: controller.login,
  })
}
