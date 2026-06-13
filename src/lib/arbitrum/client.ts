import { privateKeyToAccount } from "viem/accounts"
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  Hex,
  http,
  webSocket,
} from "viem"

import { env } from "../../config/index.js"

export const arbitrumChain = defineChain({
  id: env.ARBITRUM_CHAIN_ID,
  name: "Arbitrum One",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [env.ARBITRUM_RPC_URL] } },
})

export const publicClient = createPublicClient({
  chain: arbitrumChain,
  transport: http(env.ARBITRUM_RPC_URL),
})

export const wsPublicClient = env.ARBITRUM_WS_URL
  ? createPublicClient({
      chain: arbitrumChain,
      transport: webSocket(env.ARBITRUM_WS_URL),
    })
  : null

const isZeroPrivateKey = /^0x0{64}$/i.test(env.BACKEND_WALLET_PRIVATE_KEY)
const hasBackendWallet = !isZeroPrivateKey

export const backendAccount = hasBackendWallet
  ? privateKeyToAccount(env.BACKEND_WALLET_PRIVATE_KEY as Hex)
  : null

export const walletClient = backendAccount
  ? createWalletClient({
      account: backendAccount,
      chain: arbitrumChain,
      transport: http(env.ARBITRUM_RPC_URL),
    })
  : null

export const contractAddresses = {
  rubbiToken: env.RUBBI_TOKEN_ADDRESS as Hex,
  modal: env.MODAL_CONTRACT_ADDRESS as Hex,
  auth: env.AUTH_CONTRACT_ADDRESS as Hex,
  subscription: env.SUBSCRIPTION_CONTRACT_ADDRESS as Hex,
  salaryStreaming: env.SALARY_STREAMING_ADDRESS as Hex,
} as const
