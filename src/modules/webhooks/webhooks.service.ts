import { Prisma, TransactionType } from "@prisma/client"
import { FastifyInstance } from "fastify"
import { createHmac, timingSafeEqual } from "node:crypto"

import { env } from "../../config/index.js"

interface CardIssuerWebhookBody {
  event?: string
  data?: {
    cardId?: string
    amount?: string | number
    merchantName?: string
    merchantCategory?: string
  }
}

function verifySignature(rawBody: string, signatureHeader: string | undefined) {
  if (!signatureHeader) {
    return false
  }

  const expected = createHmac("sha256", env.SUDO_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex")

  const receivedBuffer = Buffer.from(signatureHeader)
  const expectedBuffer = Buffer.from(expected)

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

export async function handleCardIssuerWebhook(
  app: FastifyInstance,
  body: CardIssuerWebhookBody,
  signature: string | undefined,
) {
  const rawBody = JSON.stringify(body)

  if (!verifySignature(rawBody, signature)) {
    throw app.httpErrors.unauthorized("Invalid webhook signature")
  }

  const cardId = body.data?.cardId
  const amountInput = body.data?.amount

  if (!cardId || amountInput === undefined) {
    throw app.httpErrors.badRequest("Invalid webhook payload")
  }

  const amountRubbi = new Prisma.Decimal(String(amountInput))

  const card = await app.prisma.card.findUnique({
    where: { issuerId: cardId },
    include: { user: true },
  })

  if (!card) {
    throw app.httpErrors.notFound("Card not found")
  }

  if (card.user.rubbiBalance.lessThan(amountRubbi)) {
    throw app.httpErrors.badRequest("Insufficient RUBBI balance")
  }

  await app.prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: card.user.id },
      data: {
        rubbiBalance: {
          decrement: amountRubbi,
        },
      },
      select: { rubbiBalance: true },
    })

    await tx.transaction.create({
      data: {
        userId: card.user.id,
        type: TransactionType.SPEND,
        amountRubbi: amountRubbi.mul(-1),
        balanceAfter: updatedUser.rubbiBalance,
        description: `${body.data?.merchantName ?? "Card"} charge`,
        metadata: {
          merchantName: body.data?.merchantName,
          merchantCategory: body.data?.merchantCategory,
          event: body.event,
        },
      },
    })
  })

  return { ok: true }
}
