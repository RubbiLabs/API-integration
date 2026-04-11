import fastifyPlugin from "fastify-plugin"
import fastifySensible from "@fastify/sensible"

export const sensiblePlugin = fastifyPlugin(async (app) => {
  await app.register(fastifySensible)
})
