import { FastifyInstance } from "fastify"

export async function listMyDeposits(app: FastifyInstance, walletAddress: string) {
  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: { id: true },
  })

  if (!user) {
    throw app.httpErrors.notFound("User not found")
  }

  const deposits = await app.prisma.deposit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return deposits.map((deposit) => ({
    id: deposit.id,
    txHash: deposit.txHash,
    amountRaw: deposit.amountRaw,
    amountRubbi: deposit.amountRubbi.toString(),
    status: deposit.status,
    blockNumber: deposit.blockNumber.toString(),
    confirmedAt: deposit.confirmedAt,
    createdAt: deposit.createdAt,
  }))
}

export async function getDepositByHash(
  app: FastifyInstance,
  walletAddress: string,
  txHash: string,
) {
  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: { id: true },
  })

  if (!user) {
    throw app.httpErrors.notFound("User not found")
  }

  const deposit = await app.prisma.deposit.findFirst({
    where: { txHash, userId: user.id },
  })

  if (!deposit) {
    throw app.httpErrors.notFound("Deposit not found")
  }

  return {
    id: deposit.id,
    txHash: deposit.txHash,
    amountRaw: deposit.amountRaw,
    amountRubbi: deposit.amountRubbi.toString(),
    status: deposit.status,
    blockNumber: deposit.blockNumber.toString(),
    confirmedAt: deposit.confirmedAt,
    createdAt: deposit.createdAt,
  }
}
