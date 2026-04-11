import { FastifyInstance } from "fastify"
import { Worker } from "bullmq"

import { queueConnection, subscriptionQueue } from "../lib/queue.js"

export function startSubscriptionWorker(app: FastifyInstance) {
  const worker = new Worker(
    "subscription-queue",
    async (job) => {
      app.log.info({ jobId: job.id, data: job.data }, "Running subscription renewal check")

      const activeCount = await app.prisma.subscription.count({
        where: { status: "ACTIVE" },
      })

      app.log.info({ activeCount }, "Subscription check completed")
      return { ok: true, activeCount }
    },
    {
      connection: queueConnection,
      concurrency: 2,
    },
  )

  worker.on("failed", (job, error) => {
    app.log.error({ jobId: job?.id, err: error }, "Subscription worker job failed")
  })

  return worker
}

export async function scheduleSubscriptionChecks() {
  await subscriptionQueue.upsertJobScheduler(
    "daily-subscription-check",
    {
      pattern: "0 7 * * *",
      tz: "Africa/Lagos",
    },
    {
      name: "subscription-renewal-check",
      data: {
        triggeredAt: new Date().toISOString(),
      },
    },
  )
}
