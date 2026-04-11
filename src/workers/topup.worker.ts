import { Prisma, TransactionType } from "@prisma/client"
import { FastifyInstance } from "fastify"
import { Worker } from "bullmq"

import { TopupJobData, queueConnection } from "../lib/queue.js"

export function startTopupWorker(app: FastifyInstance) {
  const worker = new Worker<TopupJobData>(
    "topup-queue",
    async (job) => {
      const card = await app.prisma.card.findFirst({
        where: { userId: job.data.userId },
        select: { issuerId: true },
      })

      if (!card) {
        throw new Error(`No card found for user ${job.data.userId}`)
      }

      await app.cardIssuer.fundCard(card.issuerId, job.data.amountRubbi)
      return { ok: true }
    },
    {
      connection: queueConnection,
      concurrency: 8,
    },
  )

  worker.on("failed", async (job, error) => {
    app.log.error({ jobId: job?.id, err: error }, "Topup worker job failed")

    if (!job) {
      return
    }

    const maxAttempts = job.opts.attempts ?? 1
    if (job.attemptsMade < maxAttempts) {
      return
    }

    const rollbackKey = `topup:rollback:${job.id}`
    const lock = await app.redis.set(rollbackKey, "1", "EX", 86_400, "NX")
    if (lock !== "OK") {
      return
    }

    const amount = new Prisma.Decimal(job.data.amountRubbi)

    await app.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: job.data.userId },
        select: { rubbiBalance: true },
      })

      if (!user) {
        return
      }

      if (user.rubbiBalance.lessThan(amount)) {
        return
      }

      const updated = await tx.user.update({
        where: { id: job.data.userId },
        data: {
          rubbiBalance: { decrement: amount },
        },
        select: { rubbiBalance: true },
      })

      await tx.transaction.create({
        data: {
          userId: job.data.userId,
          type: TransactionType.REFUND,
          amountRubbi: amount.mul(-1),
          balanceAfter: updated.rubbiBalance,
          description: "Card top-up failed; RUBBI rollback",
          metadata: {
            depositId: job.data.depositId,
            queueJobId: job.id,
          },
        },
      })
    })
  })

  return worker
}
