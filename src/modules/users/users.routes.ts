import { FastifyInstance } from "fastify"

import { buildUsersController } from "./users.controller.js"

export async function registerUsersRoutes(app: FastifyInstance) {
  const controller = buildUsersController(app)

  app.get("/users/me", {
    onRequest: app.authenticate,
    schema: {
      tags: ["users"],
      description: "Get current authenticated user profile",
    },
    handler: controller.me,
  })
}
