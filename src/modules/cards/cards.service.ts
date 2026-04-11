import { CardStatus } from "@prisma/client"
import { FastifyInstance } from "fastify"

export async function getMyCard(app: FastifyInstance, walletAddress: string) {
  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    include: { card: true },
  })

  if (!user || !user.card) {
    throw app.httpErrors.notFound("Card not found")
  }

  return {
    id: user.card.id,
    issuerId: user.card.issuerId,
    last4: user.card.last4,
    expiryMonth: user.card.expiryMonth,
    expiryYear: user.card.expiryYear,
    status: user.card.status,
    rubbiBalance: user.rubbiBalance.toString(),
  }
}

export async function freezeMyCard(app: FastifyInstance, walletAddress: string) {
  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    include: { card: true },
  })

  if (!user || !user.card) {
    throw app.httpErrors.notFound("Card not found")
  }

  await app.cardIssuer.freezeCard(user.card.issuerId)
  await app.prisma.card.update({
    where: { id: user.card.id },
    data: { status: CardStatus.FROZEN },
  })

  return { status: "frozen" }
}

export async function unfreezeMyCard(app: FastifyInstance, walletAddress: string) {
  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    include: { card: true },
  })

  if (!user || !user.card) {
    throw app.httpErrors.notFound("Card not found")
  }

  await app.cardIssuer.unfreezeCard(user.card.issuerId)
  await app.prisma.card.update({
    where: { id: user.card.id },
    data: { status: CardStatus.ACTIVE },
  })

  return { status: "active" }
}

export async function revealMyCardNumber(app: FastifyInstance, walletAddress: string) {
  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    include: { card: true },
  })

  if (!user || !user.card) {
    throw app.httpErrors.notFound("Card not found")
  }

  const details = await app.cardIssuer.getCardDetails(user.card.issuerId)

  return {
    cardId: user.card.id,
    pan: details.pan ?? null,
    last4: details.last4,
    expiryMonth: details.expiryMonth,
    expiryYear: details.expiryYear,
    status: details.status,
  }
}
