import { FastifyInstance } from "fastify"
import { Worker } from "bullmq"

import { DepositJobData, queueConnection, topupQueue } from "../lib/queue.js"
import { processDepositJob } from "./deposit.processor.js"

export function startDepositWorker(app: FastifyInstance) {
  const worker = new Worker<DepositJobData>(
    "deposit-queue",
    async (job) =>
      processDepositJob(app, job.data, async (payload) => {
        await topupQueue.add("topup-card", payload)
      }),
    {
      connection: queueConnection,
      concurrency: 16,
    },
  )

  worker.on("failed", (job, error) => {
    app.log.error({ jobId: job?.id, err: error }, "Deposit worker job failed")
  })

  return worker
}
