import { Prisma, SubStatus } from "@prisma/client"
import { FastifyInstance } from "fastify"
import { decodeEventLog, Hex } from "viem"

import { env } from "../../config/index.js"
import { SubscriptionServiceABI } from "../../lib/arbitrum/abis/SubscriptionService.abi.js"
import { contractAddresses, publicClient } from "../../lib/arbitrum/client.js"

async function verifySubscriptionTx(
  app: FastifyInstance,
  walletAddress: string,
  txHash: string,
  expectedEvent: "SubscriptionStarted" | "SubscriptionPaused" | "SubscriptionResumed",
  expectedPlanId: number,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as Hex,
  })

  if (env.ARBITRUM_SETTLEMENT_TAG !== "latest") {
    const settledBlock = await publicClient.getBlock({
      blockTag: env.ARBITRUM_SETTLEMENT_TAG,
    })

    if (receipt.blockNumber > settledBlock.number) {
      throw app.httpErrors.badRequest(
        `Transaction is not ${env.ARBITRUM_SETTLEMENT_TAG} yet. Retry after more confirmations.`,
      )
    }
  }

  const normalizedWallet = walletAddress.toLowerCase()

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: SubscriptionServiceABI,
        data: log.data,
        topics: log.topics,
      })

      if (decoded.eventName !== expectedEvent) {
        continue
      }

      const args = decoded.args as {
        subscriber?: string
        planId?: bigint
      }

      if (
        args.subscriber?.toLowerCase() === normalizedWallet &&
        Number(args.planId ?? -1n) === expectedPlanId
      ) {
        return receipt.transactionHash
      }
    } catch {
      continue
    }
  }

  throw app.httpErrors.badRequest(
    `Transaction does not contain ${expectedEvent} for wallet ${normalizedWallet} and plan ${expectedPlanId}`,
  )
}

export async function listPlans() {
  const plans = await publicClient.readContract({
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    functionName: "getAllSubscriptionPlans",
  })

  return (plans as Array<{ name: string; fee: bigint; active: boolean }>).map(
    (plan, index) => ({
      planId: index,
      name: plan.name,
      feeRubbi: plan.fee.toString(),
      active: plan.active,
    }),
  )
}

export async function listMySubscriptions(app: FastifyInstance, walletAddress: string) {
  const data = await publicClient.readContract({
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    functionName: "getSubscriptionsOfAddress",
    args: [walletAddress.toLowerCase() as Hex],
  })

  return (
    data as Array<{
      active: boolean
      name: string
      fee: bigint
      userAddress: string
      subPlanId: bigint
      email: string
      password: string
    }>
  ).map((item) => ({
    active: item.active,
    planName: item.name,
    feeRubbi: item.fee.toString(),
    userAddress: item.userAddress,
    planId: Number(item.subPlanId),
  }))
}

export async function startSubscription(
  app: FastifyInstance,
  walletAddress: string,
  planId: number,
  txHash: string,
) {
  const verifiedTxHash = await verifySubscriptionTx(
    app,
    walletAddress,
    txHash,
    "SubscriptionStarted",
    planId,
  )

  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: { id: true },
  })

  if (!user) {
    throw app.httpErrors.notFound("User not found")
  }

  await app.prisma.subscription.upsert({
    where: {
      userId_onChainPlanId: { userId: user.id, onChainPlanId: planId },
    },
    update: {
      status: SubStatus.ACTIVE,
    },
    create: {
      userId: user.id,
      onChainPlanId: planId,
      planName: `Plan ${planId}`,
      feeRubbi: new Prisma.Decimal(0),
      status: SubStatus.ACTIVE,
    },
  })

  return { txHash: verifiedTxHash, verified: true }
}

export async function pauseSubscription(
  app: FastifyInstance,
  walletAddress: string,
  planId: number,
  txHash: string,
) {
  const verifiedTxHash = await verifySubscriptionTx(
    app,
    walletAddress,
    txHash,
    "SubscriptionPaused",
    planId,
  )

  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: { id: true },
  })

  if (user) {
    await app.prisma.subscription.updateMany({
      where: {
        userId: user.id,
        onChainPlanId: planId,
      },
      data: { status: SubStatus.PAUSED },
    })
  }

  return { txHash: verifiedTxHash, verified: true }
}

export async function resumeSubscription(
  app: FastifyInstance,
  walletAddress: string,
  planId: number,
  txHash: string,
) {
  const verifiedTxHash = await verifySubscriptionTx(
    app,
    walletAddress,
    txHash,
    "SubscriptionResumed",
    planId,
  )

  const user = await app.prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: { id: true },
  })

  if (user) {
    await app.prisma.subscription.updateMany({
      where: {
        userId: user.id,
        onChainPlanId: planId,
      },
      data: { status: SubStatus.ACTIVE },
    })
  }

  return { txHash: verifiedTxHash, verified: true }
}
