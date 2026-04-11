import { DepositStatus, Prisma, TransactionType } from "@prisma/client"
import { FastifyInstance } from "fastify"
import { formatUnits } from "viem"

import type { DepositJobData } from "../lib/queue.js"

export type EnqueueTopup = (payload: {
  userId: string
  depositId: string
  amountRubbi: string
}) => Promise<void>

export async function processDepositJob(
  app: FastifyInstance,
  data: DepositJobData,
  enqueueTopup: EnqueueTopup,
) {
  const walletAddress = data.walletAddress.toLowerCase()

  const user = await app.prisma.user.findUnique({
    where: { walletAddress },
    select: { id: true },
  })

  if (!user) {
    throw new Error(`No user found for wallet ${walletAddress}`)
  }

  const amountRubbi = new Prisma.Decimal(
    formatUnits(BigInt(data.amountRaw), 18),
  )

  const result = await app.prisma.$transaction(async (tx) => {
    const seen = await tx.deposit.findUnique({
      where: { txHash: data.txHash },
    })

    if (seen) {
      return { userId: user.id, depositId: seen.id, amountRubbi: seen.amountRubbi }
    }

    const deposit = await tx.deposit.create({
      data: {
        userId: user.id,
        txHash: data.txHash,
        amountRaw: data.amountRaw,
        amountRubbi,
        status: DepositStatus.CONFIRMED,
        blockNumber: BigInt(data.blockNumber),
        confirmedAt: new Date(),
      },
    })

    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        rubbiBalance: {
          increment: amountRubbi,
        },
      },
      select: { rubbiBalance: true },
    })

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: TransactionType.DEPOSIT,
        amountRubbi,
        balanceAfter: updatedUser.rubbiBalance,
        description: "On-chain deposit confirmed",
        metadata: {
          txHash: data.txHash,
          blockNumber: data.blockNumber,
        },
      },
    })

    return { userId: user.id, depositId: deposit.id, amountRubbi }
  })

  await enqueueTopup({
    userId: result.userId,
    depositId: result.depositId,
    amountRubbi: result.amountRubbi.toString(),
  })

  return { ok: true }
}
