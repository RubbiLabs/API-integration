import { Prisma, SubStatus, TransactionType } from "@prisma/client"
import { FastifyInstance } from "fastify"
import { formatUnits, hexToString } from "viem"

import { env } from "../config/index.js"
import { AuthenticationABI } from "../lib/monad/abis/Authentication.abi.js"
import { ModalContractABI } from "../lib/monad/abis/ModalContract.abi.js"
import { RubbiTokenABI } from "../lib/monad/abis/RubbiToken.abi.js"
import { SubscriptionServiceABI } from "../lib/monad/abis/SubscriptionService.abi.js"
import { contractAddresses, publicClient, wsPublicClient } from "../lib/monad/client.js"
import { depositQueue } from "../lib/queue.js"

type UnwatchFn = () => void

type GenericLog = {
  args: Record<string, unknown>
  transactionHash?: string
  logIndex?: bigint
  blockNumber?: bigint
}

const MONAD_LOG_BACKFILL_CHUNK = BigInt(env.MONAD_LOG_BACKFILL_CHUNK)

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

async function replayEventInChunks({
  app,
  eventName,
  address,
  abi,
  fromBlock,
  onLogs,
}: {
  app: FastifyInstance
  eventName: string
  address: `0x${string}`
  abi: readonly unknown[]
  fromBlock?: bigint
  onLogs: (logs: GenericLog[]) => Promise<void>
}) {
  if (fromBlock === undefined) {
    return
  }

  const latest = await publicClient.getBlockNumber()
  if (fromBlock > latest) {
    return
  }

  let cursor = fromBlock
  while (cursor <= latest) {
    const toBlock =
      cursor + MONAD_LOG_BACKFILL_CHUNK - 1n > latest
        ? latest
        : cursor + MONAD_LOG_BACKFILL_CHUNK - 1n

    const logs = await (
      publicClient as unknown as {
        getLogs: (params: Record<string, unknown>) => Promise<GenericLog[]>
      }
    ).getLogs({
      address,
      abi,
      eventName,
      fromBlock: cursor,
      toBlock,
    })

    if (logs.length > 0) {
      await onLogs(logs)
      app.log.info(
        { eventName, fromBlock: cursor.toString(), toBlock: toBlock.toString(), count: logs.length },
        "Replayed historical logs chunk",
      )
    }

    cursor = toBlock + 1n
  }
}

async function getLiveStartBlock() {
  return (await publicClient.getBlockNumber()) + 1n
}

async function handleDepositLogs(app: FastifyInstance, logs: GenericLog[]) {
  for (const log of logs) {
    const user = (log.args as { user?: string }).user
    const amount = (log.args as { _amount?: bigint })._amount
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
}

async function handleWithdrawalLogs(app: FastifyInstance, logs: GenericLog[]) {
  for (const log of logs) {
    const walletAddress = (log.args as { user?: string }).user?.toLowerCase()
    const amount = (log.args as { _amount?: bigint })._amount

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
      app.log.warn(
        { walletAddress, amount: amountRubbi.toString() },
        "Withdrawal exceeds local balance",
      )
      continue
    }

    await app.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
}

async function handleMemberEnrolledLogs(app: FastifyInstance, logs: GenericLog[]) {
  for (const log of logs) {
    const walletAddress = (log.args as { _address?: string })._address?.toLowerCase()
    const bytesName = (log.args as { name?: `0x${string}` }).name

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
}

async function handleSubscriptionStartedLogs(app: FastifyInstance, logs: GenericLog[]) {
  for (const log of logs) {
    const walletAddress = (log.args as { subscriber?: string }).subscriber?.toLowerCase()
    const planId = (log.args as { planId?: bigint }).planId

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
}

async function handleSubscriptionPaidLogs(app: FastifyInstance, logs: GenericLog[]) {
  for (const log of logs) {
    const from = (log.args as { from?: string }).from?.toLowerCase()
    const fee = (log.args as { fee?: bigint }).fee

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

    await app.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
}

async function handleSubscriptionPausedLogs(app: FastifyInstance, logs: GenericLog[]) {
  for (const log of logs) {
    const walletAddress = (log.args as { subscriber?: string }).subscriber?.toLowerCase()
    const planId = (log.args as { planId?: bigint }).planId

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
}

async function handleSubscriptionResumedLogs(app: FastifyInstance, logs: GenericLog[]) {
  for (const log of logs) {
    const walletAddress = (log.args as { subscriber?: string }).subscriber?.toLowerCase()
    const planId = (log.args as { planId?: bigint }).planId

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
}

async function handleFaucetClaimedLogs(app: FastifyInstance, logs: GenericLog[]) {
  for (const log of logs) {
    const claimer = (log.args as { claimer?: string }).claimer?.toLowerCase()
    const amount = (log.args as { amount?: bigint }).amount

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

    await app.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
}

export async function startMonadListener(app: FastifyInstance) {
  const unwatchers: UnwatchFn[] = []
  const liveClient = wsPublicClient ?? publicClient

  const register = async ({
    eventName,
    address,
    abi,
    handler,
  }: {
    eventName: string
    address: `0x${string}`
    abi: readonly unknown[]
    handler: (app: FastifyInstance, logs: GenericLog[]) => Promise<void>
  }) => {
    const resumeFrom = await getResumeBlock(app, eventName)
    await replayEventInChunks({
      app,
      eventName,
      address,
      abi,
      fromBlock: resumeFrom,
      onLogs: async (logs) => handler(app, logs),
    })

    const liveFrom = await getLiveStartBlock()

    const unwatch = (
      liveClient as unknown as {
        watchContractEvent: (config: Record<string, unknown>) => UnwatchFn
      }
    ).watchContractEvent({
      address,
      abi,
      eventName,
      fromBlock: liveFrom,
      onLogs: async (logs: GenericLog[]) => {
        await handler(app, logs)
      },
      onError: (error: unknown) => {
        app.log.error({ err: error, eventName }, "Monad event listener failed")
      },
    })

    unwatchers.push(unwatch)
  }

  await register({
    eventName: "DepositSuccessful",
    address: contractAddresses.modal,
    abi: ModalContractABI,
    handler: handleDepositLogs,
  })

  await register({
    eventName: "WithdrawalSuccessful",
    address: contractAddresses.modal,
    abi: ModalContractABI,
    handler: handleWithdrawalLogs,
  })

  await register({
    eventName: "MemberEnrolled",
    address: contractAddresses.auth,
    abi: AuthenticationABI,
    handler: handleMemberEnrolledLogs,
  })

  await register({
    eventName: "SubscriptionStarted",
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    handler: handleSubscriptionStartedLogs,
  })

  await register({
    eventName: "SubscriptionPaid",
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    handler: handleSubscriptionPaidLogs,
  })

  await register({
    eventName: "SubscriptionPaused",
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    handler: handleSubscriptionPausedLogs,
  })

  await register({
    eventName: "SubscriptionResumed",
    address: contractAddresses.subscription,
    abi: SubscriptionServiceABI,
    handler: handleSubscriptionResumedLogs,
  })

  await register({
    eventName: "FaucetClaimed",
    address: contractAddresses.rubbiToken,
    abi: RubbiTokenABI,
    handler: handleFaucetClaimedLogs,
  })

  app.log.info(
    {
      liveTransport: wsPublicClient ? "websocket" : "http-polling",
      backfillChunkSize: env.MONAD_LOG_BACKFILL_CHUNK,
    },
    "Monad event listeners started",
  )

  return () => {
    for (const unwatch of unwatchers) {
      unwatch()
    }
  }
}
