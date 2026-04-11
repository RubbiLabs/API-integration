import { FastifyInstance } from "fastify"

export async function getMe(app: FastifyInstance, walletAddress: string) {
  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    include: { card: true },
  })

  if (!user) {
    throw app.httpErrors.notFound("User not found")
  }

  return {
    id: user.id,
    walletAddress: user.walletAddress,
    username: user.username,
    rubbiBalance: user.rubbiBalance.toString(),
    card: user.card
      ? {
          id: user.card.id,
          issuerId: user.card.issuerId,
          last4: user.card.last4,
          expiryMonth: user.card.expiryMonth,
          expiryYear: user.card.expiryYear,
          status: user.card.status,
        }
      : null,
  }
}
