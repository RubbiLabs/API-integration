import { FastifyInstance } from "fastify"
import { decodeEventLog, Hex } from "viem"

import { SalaryStreamingABI } from "../../lib/arbitrum/abis/SalaryStreaming.abi.js"
import { contractAddresses, publicClient } from "../../lib/arbitrum/client.js"

interface StreamShape {
  id: string
  recipient: string
  amount: string
  lastPayment: string
  startTime: string
  intervalType: number
  active: boolean
  name: string
  streamOwner: string
}

function formatStream(raw: {
  id: bigint
  recipient: string
  amount: bigint
  lastPayment: bigint
  startTime: bigint
  intervalType: number
  active: boolean
  name: string
  streamOwner: string
}): StreamShape {
  return {
    id: raw.id.toString(),
    recipient: raw.recipient,
    amount: raw.amount.toString(),
    lastPayment: raw.lastPayment.toString(),
    startTime: raw.startTime.toString(),
    intervalType: raw.intervalType,
    active: raw.active,
    name: raw.name,
    streamOwner: raw.streamOwner,
  }
}

export async function listStreams() {
  const [daily, monthly] = await Promise.all([
    publicClient.readContract({
      address: contractAddresses.salaryStreaming,
      abi: SalaryStreamingABI,
      functionName: "getAllDailyStreams",
    }),
    publicClient.readContract({
      address: contractAddresses.salaryStreaming,
      abi: SalaryStreamingABI,
      functionName: "getAllMonthlyStreams",
    }),
  ])

  const dailyStreams = (daily as Array<any>).map(formatStream)
  const monthlyStreams = (monthly as Array<any>).map(formatStream)

  return { daily: dailyStreams, monthly: monthlyStreams }
}

export async function getStreamById(streamId: number) {
  const raw = await publicClient.readContract({
    address: contractAddresses.salaryStreaming,
    abi: SalaryStreamingABI,
    functionName: "streamsById",
    args: [BigInt(streamId)],
  })

  const stream = raw as any

  if (!stream || !stream.id || stream.id === 0n) {
    throw new Error("Stream not found")
  }

  return formatStream(stream)
}

export async function getFees() {
  const fees = await publicClient.readContract({
    address: contractAddresses.salaryStreaming,
    abi: SalaryStreamingABI,
    functionName: "fees",
  })

  return { fees: (fees as bigint).toString() }
}

export async function verifyCreateStream(
  app: FastifyInstance,
  walletAddress: string,
  txHash: string,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as Hex,
  })

  const normalizedWallet = walletAddress.toLowerCase()
  let matched = false

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: SalaryStreamingABI,
        data: log.data,
        topics: log.topics,
      })

      if (decoded.eventName !== "StreamCreated") continue

      const args = decoded.args as { streamId?: bigint; recipient?: string }
      if (args.recipient?.toLowerCase() === normalizedWallet) {
        matched = true
        return { txHash, streamId: args.streamId?.toString() ?? null, verified: true }
      }
    } catch {
      continue
    }
  }

  if (!matched) {
    throw app.httpErrors.badRequest(
      "Transaction does not contain a StreamCreated event for the authenticated wallet",
    )
  }

  return { txHash, verified: true, streamId: null }
}

export async function verifyPauseStream(
  app: FastifyInstance,
  walletAddress: string,
  streamId: number,
  txHash: string,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as Hex,
  })

  const normalizedWallet = walletAddress.toLowerCase()
  let matched = false

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: SalaryStreamingABI,
        data: log.data,
        topics: log.topics,
      })

      if (decoded.eventName !== "StreamPaused") continue

      const args = decoded.args as { recipient?: string; intervalType?: number }
      if (args.recipient?.toLowerCase() === normalizedWallet) {
        matched = true
        break
      }
    } catch {
      continue
    }
  }

  if (!matched) {
    throw app.httpErrors.badRequest(
      "Transaction does not contain a StreamPaused event for the authenticated wallet",
    )
  }

  return { txHash, streamId, verified: true }
}

export async function verifyResumeStream(
  app: FastifyInstance,
  walletAddress: string,
  streamId: number,
  txHash: string,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as Hex,
  })

  const normalizedWallet = walletAddress.toLowerCase()
  let matched = false

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: SalaryStreamingABI,
        data: log.data,
        topics: log.topics,
      })

      if (decoded.eventName !== "StreamResumed") continue

      const args = decoded.args as { recipient?: string; intervalType?: number }
      if (args.recipient?.toLowerCase() === normalizedWallet) {
        matched = true
        break
      }
    } catch {
      continue
    }
  }

  if (!matched) {
    throw app.httpErrors.badRequest(
      "Transaction does not contain a StreamResumed event for the authenticated wallet",
    )
  }

  return { txHash, streamId, verified: true }
}

export async function verifyDisburse(
  app: FastifyInstance,
  walletAddress: string,
  txHash: string,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as Hex,
  })

  const normalizedWallet = walletAddress.toLowerCase()
  let matched = false

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: SalaryStreamingABI,
        data: log.data,
        topics: log.topics,
      })

      if (decoded.eventName !== "disbursementSuccessful") continue

      const args = decoded.args as { sender?: string; recipient?: string }
      if (
        args.sender?.toLowerCase() === normalizedWallet ||
        args.recipient?.toLowerCase() === normalizedWallet
      ) {
        matched = true
        break
      }
    } catch {
      continue
    }
  }

  if (!matched) {
    throw app.httpErrors.badRequest(
      "Transaction does not contain a disbursementSuccessful event for the authenticated wallet",
    )
  }

  return { txHash, verified: true }
}
