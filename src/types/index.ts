import "fastify"

import type { PrismaClient } from "@prisma/client"
import type { Redis } from "ioredis"

import type { ICardIssuer } from "../lib/card-issuer/index.js"

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient
    redis: Redis
    cardIssuer: ICardIssuer
    authenticate: (
      request: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply,
    ) => Promise<void>
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string
    }
    user: {
      sub: string
    }
  }
}
