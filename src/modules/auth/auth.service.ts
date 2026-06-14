import { Prisma } from "@prisma/client"
import { FastifyInstance } from "fastify"
import { Hex, hexToString, stringToHex } from "viem"

import { AuthenticationABI } from "../../lib/arbitrum/abis/Authentication.abi.js"
import { contractAddresses, publicClient } from "../../lib/arbitrum/client.js"
import { LoginBody, RegisterBody } from "./auth.schema.js"

function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.toLowerCase()
}

export async function registerUser(app: FastifyInstance, input: RegisterBody) {
  const walletAddress = normalizeWalletAddress(input.walletAddress)
  const username = input.username.trim().toLowerCase()

  let onChain: unknown
  try {
    onChain = await publicClient.readContract({
      address: contractAddresses.auth,
      abi: AuthenticationABI,
      functionName: "getUserInfo",
      args: [walletAddress as Hex],
    })
  } catch {
    throw app.httpErrors.badRequest(
      "Wallet is not registered on-chain. Call Authentication.createAccount from the user wallet first.",
    )
  }

  const maybeAddress = (onChain as { address_?: string }).address_
  if (!maybeAddress || maybeAddress === "0x0000000000000000000000000000000000000000") {
    throw app.httpErrors.badRequest(
      "Wallet is not registered on-chain. Call Authentication.createAccount from the user wallet first.",
    )
  }

  const onChainNameRaw = (onChain as { name?: Hex }).name
  const onChainUsername = onChainNameRaw
    ? hexToString(onChainNameRaw).toLowerCase()
    : null

  if (!onChainUsername || onChainUsername !== username) {
    throw app.httpErrors.conflict("Provided username does not match on-chain profile")
  }

  const usernameExists = await publicClient.readContract({
    address: contractAddresses.auth,
    abi: AuthenticationABI,
    functionName: "usernameExist",
    args: [stringToHex(username)],
  })

  if (!usernameExists) {
    throw app.httpErrors.badRequest("Username is not registered on-chain for this wallet")
  }

  const user = await app.prisma.user.upsert({
    where: { walletAddress },
    update: { username },
    create: {
      walletAddress,
      username,
      rubbiBalance: new Prisma.Decimal(0),
    },
    include: { card: true },
  })

  if (!user.card) {
    const card = await app.cardIssuer.createVirtualCard({
      holderName: username,
      currency: "USD",
      type: "virtual",
    })

    await app.prisma.card.create({
      data: {
        userId: user.id,
        issuerId: card.id,
        last4: card.last4,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        status: card.status,
      },
    })
  }

  const token = app.jwt.sign({ sub: walletAddress })

  return {
    token,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      rubbiBalance: user.rubbiBalance.toString(),
    },
  }
}

export async function loginUser(app: FastifyInstance, input: LoginBody) {
  const walletAddress = normalizeWalletAddress(input.walletAddress)

  let onChain: unknown
  try {
    onChain = await publicClient.readContract({
      address: contractAddresses.auth,
      abi: AuthenticationABI,
      functionName: "getUserInfo",
      args: [walletAddress as Hex],
    })
  } catch {
    throw app.httpErrors.notFound("No on-chain account found for this wallet")
  }

  const maybeAddress = (onChain as { address_?: string }).address_

  if (!maybeAddress || maybeAddress === "0x0000000000000000000000000000000000000000") {
    throw app.httpErrors.notFound("No on-chain account found for this wallet")
  }

  const rawName = (onChain as { name?: Hex }).name
  const username = rawName ? hexToString(rawName).toLowerCase() : null

  const user = await app.prisma.user.upsert({
    where: { walletAddress },
    update: { username: username ?? undefined },
    create: {
      walletAddress,
      username: username ?? undefined,
      rubbiBalance: new Prisma.Decimal(0),
    },
  })

  const token = app.jwt.sign({ sub: walletAddress })

  return {
    token,
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      rubbiBalance: user.rubbiBalance.toString(),
    },
  }
}
