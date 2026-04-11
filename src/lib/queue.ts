import { Queue } from "bullmq"
import { Redis } from "ioredis"

import { env } from "../config/index.js"

export interface DepositJobData {
  walletAddress: string
  txHash: string
  amountRaw: string
  blockNumber: string
}

export interface TopupJobData {
  userId: string
  depositId: string
  amountRubbi: string
}

export interface SubscriptionCheckJobData {
  triggeredAt: string
}

export const queueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
})

export const depositQueue = new Queue<DepositJobData>("deposit-queue", {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 500,
  },
})

export const topupQueue = new Queue<TopupJobData>("topup-queue", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1_500 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
})

export const subscriptionQueue = new Queue<SubscriptionCheckJobData>(
  "subscription-queue",
  {
    connection: queueConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  },
)

export async function closeQueueResources() {
  await Promise.all([
    depositQueue.close(),
    topupQueue.close(),
    subscriptionQueue.close(),
    queueConnection.quit(),
  ])
}
