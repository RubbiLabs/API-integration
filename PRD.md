# Rubbi — Technical Product Requirements Document
### Backend API & Infrastructure
**Version:** 2.0.0  
**Date:** April 2026  
**Stack:** TypeScript · Fastify · Bun · Prisma · PostgreSQL · Redis · BullMQ · Viem

---

## 1. Product Overview

Rubbi is a crypto-powered virtual card platform built on the **Arbitrum blockchain**. Users interact with on-chain contracts to deposit RUBBI tokens and pay for subscriptions. The backend bridges:

- **On-chain rails** — 5 deployed Arbitrum smart contracts (ABIs confirmed)
- **Internal ledger** — RUBBI balance as the single source of truth
- **Card issuer rails** — Sudo Africa virtual Visa cards

**1 RUBBI = $1 USD.** Users never see raw token amounts. They see one number — their RUBBI balance — and that number is their card balance.

---

## 2. Deployed Smart Contracts

There are **5 contracts** on Arbitrum. ABIs have been confirmed. Contract addresses must be set in `.env` — retrieve from the smart contracts dashboard.

| Contract | Purpose | Key Events |
|---|---|---|
| `RubbiToken` | ERC20 token (RUBBI) with faucet | `Transfer`, `FaucetClaimed`, `TokensMinted` |
| `ModalContract` | Vault — deposit & withdraw RUBBI | `DepositSuccessful`, `WithdrawalSuccessful`, `TransferSuccessful` |
| `Authentication` | On-chain user registration | `MemberEnrolled` |
| `SubscriptionService` | On-chain subscription plans & payments | `SubscriptionStarted`, `SubscriptionPaid`, `SubscriptionPaused`, `SubscriptionResumed` |
| `SalaryStreaming` | Streaming payments (secondary feature) | TBD |

---

## 3. Contract ABIs (Confirmed)

### 3.1 RubbiToken.sol
Standard ERC20 + faucet + owner mint.

**Events:**
```typescript
// Standard ERC20 — emitted on every token transfer
{ type: 'event', name: 'Transfer',
  inputs: [
    { name: 'from',  type: 'address', indexed: true  },
    { name: 'to',    type: 'address', indexed: true  },
    { name: 'value', type: 'uint256', indexed: false },
  ]
}

// User claimed RUBBI from faucet
{ type: 'event', name: 'FaucetClaimed',
  inputs: [
    { name: 'claimer', type: 'address', indexed: true  },
    { name: 'amount',  type: 'uint256', indexed: false },
  ]
}

// Admin minted RUBBI to address
{ type: 'event', name: 'TokensMinted',
  inputs: [
    { name: 'to',     type: 'address', indexed: true  },
    { name: 'amount', type: 'uint256', indexed: false },
  ]
}
```

**Key Functions:**
```typescript
claimFaucet()                                      // Claim free RUBBI (cooldown enforced on-chain)
mintTo(to: address, amount: uint256)               // Owner only
balanceOf(account: address): uint256
transfer(to: address, value: uint256): bool
timeUntilNextClaim(user: address): uint256         // Seconds until next allowed claim
FAUCET_AMOUNT(): uint256                           // Fixed amount per claim
FAUCET_COOLDOWN(): uint256                         // Cooldown period in seconds
```

---

### 3.2 ModalContract.sol
The main vault. Users deposit RUBBI here to fund their card. **This is the most critical contract.**

**Events:**
```typescript
// PRIMARY TRIGGER — user deposited RUBBI into vault → fund card
{ type: 'event', name: 'DepositSuccessful',
  inputs: [
    { name: 'user',    type: 'address', indexed: true  },
    { name: '_amount', type: 'uint256', indexed: false },
  ]
}

// User withdrew RUBBI from vault → debit card balance
{ type: 'event', name: 'WithdrawalSuccessful',
  inputs: [
    { name: 'user',    type: 'address', indexed: true  },
    { name: '_amount', type: 'uint256', indexed: false },
  ]
}

// Internal transfer between two addresses
{ type: 'event', name: 'TransferSuccessful',
  inputs: [
    { name: 'sender',   type: 'address', indexed: false },
    { name: 'receiver', type: 'address', indexed: false },
    { name: '_amount',  type: 'uint256', indexed: false },
  ]
}

// Admin credited a balance
{ type: 'event', name: 'AdditionSuccessful',
  inputs: [
    { name: 'user',    type: 'address', indexed: false },
    { name: '_amount', type: 'uint256', indexed: false },
  ]
}

// Admin debited a balance
{ type: 'event', name: 'DeductionSuccessful',
  inputs: [
    { name: 'user',    type: 'address', indexed: false },
    { name: '_amount', type: 'uint256', indexed: false },
  ]
}
```

**Key Functions:**
```typescript
deposit(_amount: uint256)                          // User deposits RUBBI (requires prior approve())
withdraw(_amount: uint256)                         // User withdraws RUBBI
transfer(_sender, _recipient, _amount)             // Internal — owner only
getBalances(_address: address): uint256            // On-chain balance for any address
balances(address): uint256                         // Same as getBalances (public mapping)
contractBalance(): uint256                         // Total RUBBI held in vault
balancePlus(_address, _amount)                     // Owner: credit balance
subtractFromBalance(_userAddress, _amount)         // Owner: debit balance
OPToken(): address                                 // Returns RubbiToken contract address
```

> **Critical:** `OPToken` is the RubbiToken ERC20 address stored inside ModalContract. Users must call `RubbiToken.approve(MODAL_CONTRACT_ADDRESS, amount)` before calling `deposit`. The frontend handles the approve step — the backend only listens for `DepositSuccessful`.

---

### 3.3 Authentication.sol
On-chain user registry. Maps wallet addresses to usernames (stored as `bytes`).

**Events:**
```typescript
{ type: 'event', name: 'MemberEnrolled',
  inputs: [
    { name: '_address', type: 'address', indexed: true },
    { name: 'name',     type: 'bytes',   indexed: true },
  ]
}
```

**Key Functions:**
```typescript
createAccount(_name: bytes)                         // Register new user
getUserInfo(_userAddress: address): User            // Lookup by wallet
getUserInfoFromName(_name: bytes): User             // Lookup by username
getAddressFromName(_name: bytes): address           // Resolve username → address
usernameExist(_name: bytes): bool                   // Check availability
getAllUsers(): User[]

// User struct: { name: bytes, address_: address }
```

> **Encoding:** Username is `bytes` on-chain. Use viem's `stringToBytes` to encode and `bytesToString` to decode. Always normalize to lowercase before encoding.

---

### 3.4 SubscriptionService.sol
On-chain subscription plans. Plans are created by owner; users subscribe, pay, pause, resume via this contract. Payments flow through ModalContract in RUBBI.

**Events:**
```typescript
{ type: 'event', name: 'SubscriptionPlanCreated',
  inputs: [
    { name: 'creator',  type: 'address', indexed: false },
    { name: 'planfee',  type: 'uint256', indexed: false },
    { name: 'planName', type: 'string',  indexed: false },
  ]
}

{ type: 'event', name: 'SubscriptionStarted',
  inputs: [
    { name: 'subscriber', type: 'address', indexed: true  },
    { name: 'planId',     type: 'uint256', indexed: false },
  ]
}

{ type: 'event', name: 'SubscriptionPaid',
  inputs: [
    { name: 'from', type: 'address', indexed: false },
    { name: 'to',   type: 'address', indexed: false },
    { name: 'fee',  type: 'uint256', indexed: false },
  ]
}

{ type: 'event', name: 'SubscriptionPaused',
  inputs: [
    { name: 'subscriber', type: 'address', indexed: true  },
    { name: 'planId',     type: 'uint256', indexed: false },
  ]
}

{ type: 'event', name: 'SubscriptionResumed',
  inputs: [
    { name: 'subscriber', type: 'address', indexed: true  },
    { name: 'planId',     type: 'uint256', indexed: false },
  ]
}
```

**Key Functions:**
```typescript
// Owner plan management
addSubscriptionPlan(_name: string, _fee: uint256)
updateSubscriptionPlan(planId, _name, _fee)
activateSubscriptionPlan(planId)
deactivateSubscriptionPlan(planId)

// User actions
startSubscription(planId: uint256, _email: string, _password: string)
pauseSubscription(planId: uint256)
resumeSubscription(planId: uint256)
processSubscriptionPayments()                       // Trigger payment cycle

// Read
getAllSubscriptionPlans(): SubscriptionPlan[]       // { name, fee, active }
getSubscriptionsOfAddress(_add: address): Subscriber[]

// Subscriber struct
{ active: bool, name: string, fee: uint256, userAddress: address,
  subPlanId: uint256, email: string, password: string }
```

> **Security note:** `email` and `password` in the `Subscriber` struct are the user's Netflix/DSTV service credentials, not Rubbi credentials. These are stored on-chain. Never log them server-side.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Fastify v5 |
| Language | TypeScript (strict mode) |
| ORM | Prisma |
| Database | PostgreSQL |
| Cache / Queue Connection | Redis (ioredis) |
| Job Queue | BullMQ |
| Chain Client | Viem |
| Card Issuer | Sudo Africa API |
| Auth | Authentication.sol on-chain + JWT session |
| Validation | Zod + Fastify JSON Schema |
| Logging | Pino (built into Fastify) |

---

## 5. Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rubbi

# Redis
REDIS_URL=redis://localhost:6379
# Arbitrum Network

ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
MONAD_CHAIN_ID=10143

# Contract Addresses (retrieve from smart contracts dashboard)
RUBBI_TOKEN_ADDRESS=0x...
MODAL_CONTRACT_ADDRESS=0x...
AUTH_CONTRACT_ADDRESS=0x...
SUBSCRIPTION_CONTRACT_ADDRESS=0x...
SALARY_STREAMING_ADDRESS=0x...

# Backend Wallet (for calling write functions like createAccount on behalf of users)
BACKEND_WALLET_PRIVATE_KEY=0x...

# Card Issuer — Sudo Africa
SUDO_API_KEY=your_sudo_api_key
SUDO_BASE_URL=https://api.sudo.africa/v2
SUDO_WEBHOOK_SECRET=your_webhook_secret

# Auth
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h
```

---

## 6. Project Structure

```
rubbi-backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   └── index.ts                    # Zod-validated env vars
│   ├── plugins/
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   └── sensible.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.controller.ts
│   │   │   └── users.service.ts
│   │   ├── cards/
│   │   │   ├── cards.routes.ts
│   │   │   ├── cards.controller.ts
│   │   │   ├── cards.service.ts
│   │   │   └── cards.schema.ts
│   │   ├── deposits/
│   │   │   ├── deposits.routes.ts
│   │   │   ├── deposits.controller.ts
│   │   │   └── deposits.service.ts
│   │   ├── transactions/
│   │   │   ├── transactions.routes.ts
│   │   │   ├── transactions.controller.ts
│   │   │   └── transactions.service.ts
│   │   ├── subscriptions/
│   │   │   ├── subscriptions.routes.ts
│   │   │   ├── subscriptions.controller.ts
│   │   │   └── subscriptions.service.ts
│   │   ├── faucet/
│   │   │   ├── faucet.routes.ts
│   │   │   ├── faucet.controller.ts
│   │   │   └── faucet.service.ts
│   │   └── webhooks/
│   │       ├── webhooks.routes.ts
│   │       └── webhooks.service.ts
│   ├── workers/
│   │   ├── deposit.worker.ts
│   │   ├── topup.worker.ts
│   │   └── subscription.worker.ts
│   ├── listeners/
│   │   └── arbitrum.listener.ts
│   ├── lib/
│   │   ├── card-issuer/
│   │   │   ├── index.ts                # ICardIssuer interface
│   │   │   └── sudo.adapter.ts
│   │   ├── arbitrum/
│   │   │   ├── client.ts
│   │   │   └── abis/
│   │   │       ├── RubbiToken.abi.ts
│   │   │       ├── ModalContract.abi.ts
│   │   │       ├── Authentication.abi.ts
│   │   │       ├── SubscriptionService.abi.ts
│   │   │       └── SalaryStreaming.abi.ts
│   │   ├── queue.ts
│   │   └── logger.ts
│   └── types/
│       └── index.ts
├── prisma/
│   └── schema.prisma
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 7. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String        @id @default(uuid())
  walletAddress   String        @unique
  username        String?       @unique    // decoded from Authentication.sol bytes
  rubbiBalance    Decimal       @default(0) @db.Decimal(18, 6)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  card            Card?
  deposits        Deposit[]
  transactions    Transaction[]
  subscriptions   Subscription[]
}

model Card {
  id              String      @id @default(uuid())
  userId          String      @unique
  user            User        @relation(fields: [userId], references: [id])
  issuerId        String      @unique       // Sudo Africa card ID
  last4           String
  expiryMonth     String
  expiryYear      String
  status          CardStatus  @default(ACTIVE)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model Deposit {
  id              String        @id @default(uuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id])
  txHash          String        @unique     // deduplication key
  amountRaw       String                    // raw uint256 from contract
  amountRubbi     Decimal       @db.Decimal(18, 6)
  status          DepositStatus @default(PENDING)
  blockNumber     BigInt
  confirmedAt     DateTime?
  createdAt       DateTime      @default(now())
}

model Transaction {
  id              String            @id @default(uuid())
  userId          String
  user            User              @relation(fields: [userId], references: [id])
  type            TransactionType
  amountRubbi     Decimal           @db.Decimal(18, 6)
  balanceAfter    Decimal           @db.Decimal(18, 6)
  description     String
  metadata        Json?
  createdAt       DateTime          @default(now())
}

model Subscription {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id])
  onChainPlanId     Int                             // planId from SubscriptionService.sol
  planName          String
  feeRubbi          Decimal   @db.Decimal(18, 6)
  status            SubStatus @default(ACTIVE)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

enum CardStatus      { ACTIVE FROZEN TERMINATED }
enum DepositStatus   { PENDING CONFIRMED FAILED }
enum TransactionType { DEPOSIT SPEND REFUND SUBSCRIPTION_PAYMENT FAUCET }
enum SubStatus       { ACTIVE PAUSED CANCELLED }
```

---

## 8. Viem Client Setup

### `src/lib/arbitrum/client.ts`
```typescript
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { defineChain } from 'viem'

export const arbitrum = defineChain({
  id: Number(process.env.ARBITRUM_CHAIN_ID),
  name: 'Arbitrum One',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARBITRUM_RPC_URL!] } }
})

// Read-only client — for listening to events and reading state
export const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http()
})

// Write client — for calling contract functions (createAccount, claimFaucet, etc.)
export const backendAccount = privateKeyToAccount(
  process.env.BACKEND_WALLET_PRIVATE_KEY as `0x${string}`
)
export const walletClient = createWalletClient({
  account: backendAccount,
  chain: arbitrum,
  transport: http()
})
```

### ABI Files
Copy the `abi` array from each JSON file in `contract-ABIs/` into the corresponding TypeScript file as a typed `as const` export. Example:

```typescript
// src/lib/arbitrum/abis/ModalContract.abi.ts
export const ModalContractABI = [
  {
    type: 'event',
    name: 'DepositSuccessful',
    inputs: [
      { name: 'user',    type: 'address', indexed: true  },
      { name: '_amount', type: 'uint256', indexed: false },
    ]
  },
  // ... rest of ABI
] as const
```

---

## 9. Arbitrum Event Listener

`src/listeners/arbitrum.listener.ts` is a long-lived process. Start it in Fastify's `onReady` hook.

### Events to Watch

| Contract | Event | Action |
|---|---|---|
| `ModalContract` | `DepositSuccessful` | Credit RUBBI → fund card (**highest priority**) |
| `ModalContract` | `WithdrawalSuccessful` | Debit RUBBI balance |
| `Authentication` | `MemberEnrolled` | Sync new user to DB |
| `SubscriptionService` | `SubscriptionStarted` | Create subscription record in DB |
| `SubscriptionService` | `SubscriptionPaid` | Log payment transaction |
| `SubscriptionService` | `SubscriptionPaused` | Update subscription status |
| `SubscriptionService` | `SubscriptionResumed` | Update subscription status |
| `RubbiToken` | `FaucetClaimed` | Credit faucet RUBBI to user |

### Deposit Listener (core pattern)
```typescript
publicClient.watchContractEvent({
  address: process.env.MODAL_CONTRACT_ADDRESS as `0x${string}`,
  abi: ModalContractABI,
  eventName: 'DepositSuccessful',
  onLogs: async (logs) => {
    for (const log of logs) {
      const { user, _amount } = log.args
      const txHash = log.transactionHash

      // Deduplicate
      const seen = await redis.get(`deposit:seen:${txHash}`)
      if (seen) continue
      await redis.set(`deposit:seen:${txHash}`, '1', 'EX', 86400)

      await depositQueue.add('process-deposit', {
        walletAddress: user,
        txHash,
        amountRaw: _amount.toString(),
        blockNumber: log.blockNumber.toString()
      })
    }
  }
})
```

---

## 10. Deposit-to-Card Full Pipeline

```
User calls ModalContract.deposit(_amount) on Arbitrum
          ↓ (~0.4s block time)
Contract emits DepositSuccessful(user, _amount)
          ↓ (<100ms)
arbitrum.listener.ts detects event
          ↓
Redis dedup check (key: deposit:seen:{txHash}, TTL 24h)
          ↓
BullMQ depositQueue receives job
          ↓
deposit.worker.ts:
  1. Find user by walletAddress
  2. formatUnits(BigInt(amountRaw), 18) → amountRubbi
  3. Atomic DB transaction:
     - Create Deposit { txHash, amountRaw, amountRubbi, status: CONFIRMED }
     - user.rubbiBalance += amountRubbi
     - Create Transaction { type: DEPOSIT, amountRubbi, balanceAfter, description }
          ↓
BullMQ topupQueue receives job
          ↓
topup.worker.ts:
  1. Find card by userId (issuerId)
  2. POST /cards/{issuerId}/fund to Sudo Africa
  3. On success → push notification "Your Rubbi card is loaded 🎉"
  4. On failure → retry 3x backoff → rollback rubbiBalance → alert ops

Target: < 5 seconds end-to-end
```

### Amount Conversion (CRITICAL)
```typescript
import { formatUnits } from 'viem'
// RUBBI has 18 decimals (standard ERC20)
const amountRubbi = formatUnits(BigInt(amountRaw), 18)
// 1000000000000000000n → "1.0"
```

---

## 11. Auth Flow

Rubbi uses `Authentication.sol` for on-chain registration + JWT for session.

### Registration: `POST /auth/register { walletAddress, username }`
```
1. Encode username: stringToBytes(username.toLowerCase())
2. Check usernameExist(encodedName) on-chain
3. If taken → 409 Conflict
4. Call createAccount(encodedName) via walletClient
5. Wait for MemberEnrolled event (or poll)
6. Create User in DB
7. Create Sudo Africa card silently
8. Return JWT
```

### Login: `POST /auth/login { walletAddress }`
```
1. Call getUserInfo(walletAddress) on Authentication.sol
2. If not found on-chain → 404
3. Find or create user in DB
4. Return JWT
```

---

## 12. API Routes

All routes prefixed: `/api/v1`

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | On-chain createAccount + DB user + Sudo card |
| `POST` | `/auth/login` | On-chain getUserInfo + JWT |

### Users
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me` | ✅ | Profile + RUBBI balance |

### Cards
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/cards/me` | ✅ | last4, expiry, status, RUBBI balance |
| `POST` | `/cards/freeze` | ✅ | Freeze card |
| `POST` | `/cards/unfreeze` | ✅ | Unfreeze card |
| `GET` | `/cards/me/number` | ✅ | Full card number (sensitive) |

### Deposits
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/deposits` | ✅ | Deposit history |
| `GET` | `/deposits/:txHash` | ✅ | Status by tx hash |

### Transactions
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/transactions` | ✅ | RUBBI ledger history (paginated) |

### Subscriptions
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/subscriptions/plans` | ✅ | All active plans (from chain) |
| `GET` | `/subscriptions/me` | ✅ | User's subscriptions (from chain) |
| `POST` | `/subscriptions/start` | ✅ | `{ planId, email, password }` |
| `POST` | `/subscriptions/:planId/pause` | ✅ | Pause |
| `POST` | `/subscriptions/:planId/resume` | ✅ | Resume |

### Faucet
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/faucet/claim` | ✅ | Call RubbiToken.claimFaucet() + credit RUBBI |
| `GET` | `/faucet/cooldown` | ✅ | Seconds until next claim |

### Webhooks
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/webhooks/card-issuer` | HMAC | Sudo Africa spend events |

---

## 13. Card Issuer Abstraction

### `src/lib/card-issuer/index.ts`
```typescript
export interface ICardIssuer {
  createVirtualCard(params: CreateCardParams): Promise<CardResult>
  fundCard(cardId: string, amountRubbi: number): Promise<void>
  freezeCard(cardId: string): Promise<void>
  unfreezeCard(cardId: string): Promise<void>
  getCardDetails(cardId: string): Promise<CardDetails>
}

export interface CreateCardParams {
  holderName: string
  currency: 'USD'
  type: 'virtual'
}

export interface CardResult {
  id: string        // Issuer's card ID — store as issuerId
  last4: string
  expiryMonth: string
  expiryYear: string
  status: string
}
```

### `src/lib/card-issuer/sudo.adapter.ts`
```
Base URL: https://api.sudo.africa/v2
Auth: Authorization: Bearer {SUDO_API_KEY}

POST   /cards/virtual              → createVirtualCard
POST   /cards/{id}/fund            → fundCard   body: { amount, currency: 'USD' }
PUT    /cards/{id}/freeze          → freezeCard
PUT    /cards/{id}/unfreeze        → unfreezeCard
GET    /cards/{id}                 → getCardDetails
```
Reference: https://docs.sudo.africa

---

## 14. Webhook Handler

```typescript
// Verify HMAC
const signature = request.headers['x-sudo-signature']
const computed  = crypto
  .createHmac('sha256', SUDO_WEBHOOK_SECRET)
  .update(JSON.stringify(request.body))
  .digest('hex')
if (signature !== computed) throw new UnauthorizedError()

// Debit RUBBI atomically on card charge
await prisma.$transaction([
  prisma.user.update({
    where: { card: { issuerId: cardId } },
    data:  { rubbiBalance: { decrement: amountRubbi } }
  }),
  prisma.transaction.create({
    data: {
      type: 'SPEND',
      amountRubbi: -amountRubbi,
      description: `${merchantName} charge`,
      metadata: { merchantName, merchantCategory }
    }
  })
])
```

---

## 15. BullMQ Workers

### Queue Definitions (`src/lib/queue.ts`)
```typescript
import { Queue } from 'bullmq'
export const depositQueue      = new Queue('deposit-queue',      { connection: redis })
export const topupQueue        = new Queue('topup-queue',        { connection: redis })
export const subscriptionQueue = new Queue('subscription-queue', { connection: redis })
```

### deposit.worker.ts
- Trigger: `DepositSuccessful` event
- Parse `amountRaw` with `formatUnits(BigInt(amountRaw), 18)`
- Atomic: `Deposit` + `rubbiBalance` increment + `Transaction`
- On success → enqueue `topup-queue`

### topup.worker.ts
- Trigger: deposit.worker success
- Call `cardIssuer.fundCard(issuerId, amountRubbi)`
- Retry 3x on failure → rollback `rubbiBalance` → alert ops

### subscription.worker.ts
- Trigger: Cron daily at 08:00 WAT
- Read from `SubscriptionService.getSubscriptionsOfAddress`
- Cross-reference `ModalContract.getBalances` for on-chain balance
- Alert users with insufficient RUBBI before billing

---

## 16. RUBBI Balance Invariants

1. `rubbiBalance` can never go below `0`
2. Every change to `rubbiBalance` requires a `Transaction` record in the **same DB transaction**
3. Deposits only credited after `DepositSuccessful` event — never on mempool
4. Card top-up only after RUBBI credited in DB
5. If top-up fails → rollback `rubbiBalance`
6. All monetary values use `Decimal` with 6dp — never JavaScript `number`

---

## 17. Error Handling

| Scenario | Behaviour |
|---|---|
| Same `txHash` twice | Redis dedup — second dropped silently |
| `walletAddress` not in DB | Dead-letter queue — do not credit RUBBI |
| Sudo Africa top-up fails | Retry 3x → rollback → alert ops |
| Webhook HMAC invalid | 401 + log |
| `rubbiBalance` would go negative | Throw + reject + do not persist |
| Arbitrum RPC disconnects | Reconnect with backoff, replay from last `blockNumber` |
| Username bytes mismatch | Normalize to lowercase before encoding |

---

## 18. Performance Targets

| Metric | Target |
|---|---|
| Deposit detection latency | < 1s after on-chain confirmation |
| Deposit-to-card-ready | < 5s end-to-end |
| API p95 response time | < 100ms |
| Queue job processing | < 2s |
| Webhook processing | < 500ms |

---

## 19. Copilot Task Checklist

**Do not change folder structure, stack, or naming conventions.**

### Priority 1 — Foundation
- [ ] Scaffold `src/app.ts` + `src/server.ts` (Fastify + Bun)
- [ ] Wire Prisma, Redis, Sensible plugins
- [ ] `prisma migrate dev` with schema in section 7
- [ ] Copy ABI arrays from `contract-ABIs/*.json` → `src/lib/arbitrum/abis/*.abi.ts` as `as const` exports
- [ ] Implement `src/lib/arbitrum/client.ts` (publicClient + walletClient)
- [ ] Implement `src/listeners/arbitrum.listener.ts` — `DepositSuccessful` first, then all events in section 9
- [ ] Implement `src/lib/card-issuer/index.ts` + `sudo.adapter.ts`
- [ ] Implement `src/workers/deposit.worker.ts`
- [ ] Implement `src/workers/topup.worker.ts`

### Priority 2 — API Routes
- [ ] `modules/auth/` — register (on-chain + DB + card), login (on-chain lookup + JWT)
- [ ] `modules/users/` — GET /users/me
- [ ] `modules/cards/` — get, freeze, unfreeze, reveal number
- [ ] `modules/deposits/` — history + by txHash
- [ ] `modules/transactions/` — paginated ledger

### Priority 3 — Subscriptions & Faucet
- [ ] `modules/subscriptions/` — read plans from chain, start/pause/resume
- [ ] `modules/faucet/` — claim + cooldown
- [ ] `src/workers/subscription.worker.ts` — daily cron

### Priority 4 — Hardening
- [ ] `modules/webhooks/` — HMAC verified spend handler
- [ ] Zod validation on all env vars (`src/config/index.ts`)
- [ ] Rate limiting (`@fastify/rate-limit`)
- [ ] Swagger docs (`@fastify/swagger`)
- [ ] Integration tests for deposit pipeline

---

## 20. Key Notes for Copilot

- **ABI source:** Raw JSON is in `contract-ABIs/`. Use only the `abi` array, typed `as const`.
- **Amount precision:** RUBBI = 18 decimals. Always `formatUnits(bigint, 18)`. Store as Prisma `Decimal`.
- **Username bytes:** `stringToBytes(username.toLowerCase())` to encode, `bytesToString(bytes)` to decode.
- **Subscription credentials:** `email` + `password` in `Subscriber` struct are service credentials. Never log.
- **Card creation:** Happens silently on first registration. User never requests it.
- **Faucet write:** `claimFaucet()` is a write tx — use `walletClient` with `BACKEND_WALLET_PRIVATE_KEY`. Alternatively, let frontend call it directly and only listen for `FaucetClaimed` events.
- **approve() step:** Frontend calls `RubbiToken.approve(MODAL_CONTRACT_ADDRESS, amount)` before deposit. Backend ignores this — only listens for `DepositSuccessful`.
- **Listener startup:** Call `arbitrum.listener.ts` inside Fastify `onReady` hook, after all plugins are registered.
- **Never store:** Full card numbers or CVV. Only `last4`, `expiryMonth`, `expiryYear`, `issuerId`.
- **Contract addresses:** All 5 addresses come from the smart contracts dashboard. Set in `.env`. Do not hardcode.