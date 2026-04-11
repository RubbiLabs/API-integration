import { Prisma, SubStatus, TransactionType } from "@prisma/client"
import { FastifyInstance } from "fastify"
import { formatUnits, hexToString } from "viem"

import { AuthenticationABI } from "../lib/monad/abis/Authentication.abi.js"
import { ModalContractABI } from "../lib/monad/abis/ModalContract.abi.js"
import { RubbiTokenABI } from "../lib/monad/abis/RubbiToken.abi.js"
import { SubscriptionServiceABI } from "../lib/monad/abis/SubscriptionService.abi.js"
import { contractAddresses, publicClient } from "../lib/monad/client.js"
import { depositQueue } from "../lib/queue.js"

type UnwatchFn = () => void

function checkpointKey(eventName: string) {
  return `listener:block:${eventName}`
}

async function getResumeBlock(app: FastifyInstance, eventName: string) {
  const raw = await app.redis.get(checkpointKey(eventName))
  if (!raw) {
    return undefined
  }

  try {
    return BigInt(raw) + 1n
  } catch {
    return undefined
  }
}

async function saveCheckpoint(
  app: FastifyInstance,
  eventName: string,
  logs: Array<{ blockNumber?: bigint }>,
) {
  let maxBlock: bigint | undefined

  for (const log of logs) {
    if (log.blockNumber === undefined) {
      continue
    }

    if (maxBlock === undefined || log.blockNumber > maxBlock) {
      maxBlock = log.blockNumber
    }
  }

  if (maxBlock !== undefined) {
    await app.redis.set(checkpointKey(eventName), maxBlock.toString())
  }
}

function withLogKey(txHash: string | undefined, logIndex: number | undefined) {
  if (!txHash) {
    return null
  }

  return `${txHash}:${logIndex ?? 0}`
}

export async function startMonadListener(app: FastifyInstance) {
  const unwatchers: UnwatchFn[] = []
  const depositFromBlock = await getResumeBlock(app, "DepositSuccessful")

  const depositUnwatch = publicClient.watchContractEvent({
    address: contractAddresses.modal,
    abi: ModalContractABI,
    eventName: "DepositSuccessful",
    fromBlock: depositFromBlock,
    onLogs: async (logs) => {
      for (const log of logs) {
        const user = log.args.user
        const amount = log.args._amount
        const txHash = log.transactionHash

        if (!user || amount === undefined || !txHash) {
          continue
        }

        const dedupKey = withLogKey(txHash, Number(log.logIndex ?? 0n))
        if (!dedupKey) {
          continue
        }

        const lock = await app.redis.set(
          `listener:deposit:${dedupKey}`,
          "1",
          "EX",
          86_400,
          "NX",
        )

        if (lock !== "OK") {
          continue
        }

        await depositQueue.add("process-deposit", {
          walletAddress: user.toLowerCase(),
          txHash,
          amountRaw: amount.toString(),
          blockNumber: log.blockNumber?.toString() ?? "0",
        })
      }

      await saveCheckpoint(app, "DepositSuccessful", logs)
    },
    onError: (error) => {
      app.log.error({ err: error }, "Deposit event listener failed")
    },
  })
  unwatchers.push(depositUnwatch)

  const withdrawalFromBlock = await getResumeBlock(app, "WithdrawalSuccessful")

  const withdrawalUnwatch = publicClient.watchContractEvent({
    address: contractAddresses.modal,
    abi: ModalContractABI,
    eventName: "WithdrawalSuccessful",
    fromBlock: withdrawalFromBlock,
    onLogs: async (logs) => {
      for (const log of logs) {
        const walletAddress = log.args.user?.toLowerCase()
        const amount = log.args._amount

        if (!walletAddress || amount === undefined) {
          continue
        }

        const user = await app.prisma.user.findUnique({
          where: { walletAddress },
          select: { id: true, rubbiBalance: true },
        })

        if (!user) {
          continue
        }

        const amountRubbi = new Prisma.Decimal(formatUnits(amount, 18))
        if (user.rubbiBalance.lessThan(amountRubbi)) {
          app.log.warn({ walletAddress, amount: amountRubbi.toString() }, "Withdrawal exceeds local balance")
          continue
        }

        await app.prisma.$transaction(async (tx) => {
          const updatedUser = await tx.user.update({
            where: { id: user.id },
            data: {
              rubbiBalance: {
                decrement: amountRubbi,
              },
            },
            select: { rubbiBalance: true },
          })

          await tx.transaction.create({
            data: {
              userId: user.id,
              type: TransactionType.REFUND,
              amountRubbi: amountRubbi.mul(-1),
              balanceAfter: updatedUser.rubbiBalance,
              description: "On-chain withdrawal",
              metadata: {
                txHash: log.transactionHash,
              },
            },
          })
        })
      }

      await saveCheckpoint(app, "WithdrawalSuccessful", logs)
    },
    onError: (error) => {
      app.log.error({ err: error }, "Withdrawal event listener failed")
    },
  })
  unwatchers.push(withdrawalUnwatch)

  const memberFromBlock = await getResumeBlock(app, "MemberEnrolled")

  const memberUnwatch = publicClient.watchContractEvent({
    address: contractAddresses.auth,
    abi: AuthenticationABI,
    eventName: "MemberEnrolled",
    fromBlock: memberFromBlock,
    onLogs: async (logs) => {
      for (const log of logs) {
        const walletAddress = log.args._address?.toLowerCase()
        const bytesName = log.args.name

        if (!walletAddress) {
          continue
        }

        const username = bytesName ? hexToString(bytesName).toLowerCase() : null

        await app.prisma.user.upsert({
          where: { walletAddress },
          update: { username: username ?? undefined },
          create: {
            walletAddress,
            username: username ?? undefined,
            rubbiBalance: new Prisma.Decimal(0),
          },
        })
      }

      await saveCheckpoint(app, "MemberEnrolled", logs)
    },
    onError: (error) => {
      app.log.error({ err: error }, "MemberEnrolled listener failed")
    },
  })
  unwatchers.push(memberUnwatch)

  const subscriptionStartedFromBlock = await getResumeBlock(app, "SubscriptionStarted")

  const subscriptionStartedUnwatch = publicClient.watchContractEvent({
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    eventName: "SubscriptionStarted",
    fromBlock: subscriptionStartedFromBlock,
    onLogs: async (logs) => {
      for (const log of logs) {
        const walletAddress = log.args.subscriber?.toLowerCase()
        const planId = log.args.planId

        if (!walletAddress || planId === undefined) {
          continue
        }

        const user = await app.prisma.user.findUnique({
          where: { walletAddress },
          select: { id: true },
        })

        if (!user) {
          continue
        }

        await app.prisma.subscription.upsert({
          where: { id: `${user.id}:${Number(planId)}` },
          update: { status: SubStatus.ACTIVE },
          create: {
            id: `${user.id}:${Number(planId)}`,
            userId: user.id,
            onChainPlanId: Number(planId),
            planName: `Plan ${Number(planId)}`,
            feeRubbi: new Prisma.Decimal(0),
            status: SubStatus.ACTIVE,
          },
        })
      }

      await saveCheckpoint(app, "SubscriptionStarted", logs)
    },
    onError: (error) => {
      app.log.error({ err: error }, "SubscriptionStarted listener failed")
    },
  })
  unwatchers.push(subscriptionStartedUnwatch)

  const subscriptionPaidFromBlock = await getResumeBlock(app, "SubscriptionPaid")

  const subscriptionPaidUnwatch = publicClient.watchContractEvent({
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    eventName: "SubscriptionPaid",
    fromBlock: subscriptionPaidFromBlock,
    onLogs: async (logs) => {
      for (const log of logs) {
        const from = log.args.from?.toLowerCase()
        const fee = log.args.fee

        if (!from || fee === undefined) {
          continue
        }

        const user = await app.prisma.user.findUnique({
          where: { walletAddress: from },
          select: { id: true, rubbiBalance: true },
        })

        if (!user) {
          continue
        }

        const amountRubbi = new Prisma.Decimal(formatUnits(fee, 18))
        if (user.rubbiBalance.lessThan(amountRubbi)) {
          continue
        }

        await app.prisma.$transaction(async (tx) => {
          const updated = await tx.user.update({
            where: { id: user.id },
            data: {
              rubbiBalance: {
                decrement: amountRubbi,
              },
            },
            select: { rubbiBalance: true },
          })

          await tx.transaction.create({
            data: {
              userId: user.id,
              type: TransactionType.SUBSCRIPTION_PAYMENT,
              amountRubbi: amountRubbi.mul(-1),
              balanceAfter: updated.rubbiBalance,
              description: "Subscription payment processed",
              metadata: { txHash: log.transactionHash },
            },
          })
        })
      }

      await saveCheckpoint(app, "SubscriptionPaid", logs)
    },
    onError: (error) => {
      app.log.error({ err: error }, "SubscriptionPaid listener failed")
    },
  })
  unwatchers.push(subscriptionPaidUnwatch)

  const subscriptionPausedFromBlock = await getResumeBlock(app, "SubscriptionPaused")

  const subscriptionPausedUnwatch = publicClient.watchContractEvent({
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    eventName: "SubscriptionPaused",
    fromBlock: subscriptionPausedFromBlock,
    onLogs: async (logs) => {
      for (const log of logs) {
        const walletAddress = log.args.subscriber?.toLowerCase()
        const planId = log.args.planId

        if (!walletAddress || planId === undefined) {
          continue
        }

        const user = await app.prisma.user.findUnique({
          where: { walletAddress },
          select: { id: true },
        })

        if (!user) {
          continue
        }

        await app.prisma.subscription.updateMany({
          where: {
            userId: user.id,
            onChainPlanId: Number(planId),
          },
          data: {
            status: SubStatus.PAUSED,
          },
        })
      }

      await saveCheckpoint(app, "SubscriptionPaused", logs)
    },
    onError: (error) => {
      app.log.error({ err: error }, "SubscriptionPaused listener failed")
    },
  })
  unwatchers.push(subscriptionPausedUnwatch)

  const subscriptionResumedFromBlock = await getResumeBlock(app, "SubscriptionResumed")

  const subscriptionResumedUnwatch = publicClient.watchContractEvent({
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    eventName: "SubscriptionResumed",
    fromBlock: subscriptionResumedFromBlock,
    onLogs: async (logs) => {
      for (const log of logs) {
        const walletAddress = log.args.subscriber?.toLowerCase()
        const planId = log.args.planId

        if (!walletAddress || planId === undefined) {
          continue
        }

        const user = await app.prisma.user.findUnique({
          where: { walletAddress },
          select: { id: true },
        })

        if (!user) {
          continue
        }

        await app.prisma.subscription.updateMany({
          where: {
            userId: user.id,
            onChainPlanId: Number(planId),
          },
          data: {
            status: SubStatus.ACTIVE,
          },
        })
      }

      await saveCheckpoint(app, "SubscriptionResumed", logs)
    },
    onError: (error) => {
      app.log.error({ err: error }, "SubscriptionResumed listener failed")
    },
  })
  unwatchers.push(subscriptionResumedUnwatch)

  const faucetFromBlock = await getResumeBlock(app, "FaucetClaimed")

  const faucetUnwatch = publicClient.watchContractEvent({
    address: contractAddresses.rubbiToken,
    abi: RubbiTokenABI,
    eventName: "FaucetClaimed",
    fromBlock: faucetFromBlock,
    onLogs: async (logs) => {
      for (const log of logs) {
        const claimer = log.args.claimer?.toLowerCase()
        const amount = log.args.amount

        if (!claimer || amount === undefined) {
          continue
        }

        const user = await app.prisma.user.findUnique({
          where: { walletAddress: claimer },
          select: { id: true },
        })

        if (!user) {
          continue
        }

        const amountRubbi = new Prisma.Decimal(formatUnits(amount, 18))

        await app.prisma.$transaction(async (tx) => {
          const updated = await tx.user.update({
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
              type: TransactionType.FAUCET,
              amountRubbi,
              balanceAfter: updated.rubbiBalance,
              description: "Faucet claim confirmed",
              metadata: { txHash: log.transactionHash },
            },
          })
        })
      }

      await saveCheckpoint(app, "FaucetClaimed", logs)
    },
    onError: (error) => {
      app.log.error({ err: error }, "FaucetClaimed listener failed")
    },
  })
  unwatchers.push(faucetUnwatch)

  app.log.info("Monad event listeners started")

  return () => {
    for (const unwatch of unwatchers) {
      unwatch()
    }
  }
}
