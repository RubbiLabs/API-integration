import { FastifyInstance } from "fastify"

import { buildUsersController } from "./users.controller.js"

export async function registerUsersRoutes(app: FastifyInstance) {
  const controller = buildUsersController(app)

  app.get("/users/me", {
    onRequest: app.authenticate,
    schema: {
      tags: ["users"],
      description: "Get current authenticated user profile",
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            walletAddress: { type: "string" },
            username: { type: "string" },
            rubbiBalance: { type: "string" },
            card: {
              nullable: true,
              type: "object",
              properties: {
                id: { type: "string" },
                issuerId: { type: "string" },
                last4: { type: "string" },
                expiryMonth: { type: "number" },
                expiryYear: { type: "number" },
                status: { type: "string" },
              },
            },
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
}
