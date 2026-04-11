import { FastifyInstance } from "fastify"

interface ListTransactionsOptions {
  page: number
  pageSize: number
}

export async function listMyTransactions(
  app: FastifyInstance,
  walletAddress: string,
  options: ListTransactionsOptions,
) {
  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: { id: true },
  })

  if (!user) {
    throw app.httpErrors.notFound("User not found")
  }

  const page = Math.max(1, options.page)
  const pageSize = Math.min(100, Math.max(1, options.pageSize))
  const skip = (page - 1) * pageSize

  const [items, total] = await Promise.all([
    app.prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    app.prisma.transaction.count({ where: { userId: user.id } }),
  ])

  return {
    page,
    pageSize,
    total,
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      amountRubbi: item.amountRubbi.toString(),
      balanceAfter: item.balanceAfter.toString(),
      description: item.description,
      metadata: item.metadata,
      createdAt: item.createdAt,
    })),
  }
}
