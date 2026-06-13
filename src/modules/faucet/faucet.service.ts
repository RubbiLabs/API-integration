import { FastifyInstance } from "fastify"
import { decodeEventLog, Hex } from "viem"

import { env } from "../../config/index.js"
import { RubbiTokenABI } from "../../lib/arbitrum/abis/RubbiToken.abi.js"
import { contractAddresses, publicClient } from "../../lib/arbitrum/client.js"

export async function claimFaucet(
  app: FastifyInstance,
  walletAddress: string,
  txHash: string,
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
  let matchedClaim = false

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: RubbiTokenABI,
        data: log.data,
        topics: log.topics,
      })

      if (decoded.eventName !== "FaucetClaimed") {
        continue
      }

      const claimer = (decoded.args as { claimer?: string }).claimer?.toLowerCase()
      if (claimer === normalizedWallet) {
        matchedClaim = true
        break
      }
    } catch {
      continue
    }
  }

  if (!matchedClaim) {
    throw app.httpErrors.badRequest(
      "Transaction does not include a FaucetClaimed event for the authenticated wallet",
    )
  }

  app.log.info({ walletAddress: normalizedWallet, txHash }, "Faucet claim verified")

  return { txHash, verified: true }
}

export async function faucetCooldown(walletAddress: string) {
  const cooldownSeconds = await publicClient.readContract({
    address: contractAddresses.rubbiToken,
    abi: RubbiTokenABI,
    functionName: "timeUntilNextClaim",
    args: [walletAddress.toLowerCase() as Hex],
  })

  return {
    walletAddress: walletAddress.toLowerCase(),
    cooldownSeconds: Number(cooldownSeconds),
  }
}
