# Rubbi API — Frontend Integration Guide

## Base URL

```
https://rubbi-api.onrender.com/api/v1
```

All endpoints return JSON. Swagger UI is available at `GET /docs`.

---

## Authentication

### How to get a token

1. **User connects wallet** (MetaMask, WalletConnect, etc.) on **Arbitrum**.
2. **User signs a transaction** calling `Authentication.createAccount(username)` on-chain. This registers their wallet with a username.
3. **POST /auth/register** — `{ walletAddress, username }` — returns `{ token, user }`. A virtual card is auto-created.
4. On subsequent visits: **POST /auth/login** — `{ walletAddress }` — returns a fresh `{ token, user }`.

### How to send the token

```
Authorization: Bearer <jwt>
```

Invalid/expired tokens return **401**.

### JWT payload

```json
{ "sub": "0xabc...", "iat": 123, "exp": 456 }
```

`sub` is the lowercased wallet address.

---

## Error format

All errors use the standard Fastify shape:

```json
{ "statusCode": 400, "error": "Bad Request", "message": "..." }
```

| Code | Meaning              | Common causes                                  |
|------|----------------------|------------------------------------------------|
| 400  | Bad Request          | Invalid input, on-chain verification failed    |
| 401  | Unauthorized         | Missing/expired JWT, invalid webhook HMAC      |
| 404  | Not Found            | User/card/deposit not found                    |
| 409  | Conflict             | Username doesn't match on-chain profile        |
| 429  | Too Many Requests    | Rate limit (120/min, 600/min for webhooks)     |

---

## Rate limiting

- Default: **120 requests/minute** per IP
- Webhooks: **600 requests/minute**

---

## Endpoints

### GET /health

No auth. Returns:

```json
{ "status": "ok", "service": "rubbi-api", "timestamp": "2026-01-01T00:00:00.000Z" }
```

---

### POST /auth/register

No auth. Register a wallet that has already called `Authentication.createAccount()` on-chain.

**Body:**

```json
{ "walletAddress": "0x...", "username": "alice_123" }
```

`username` must match the name used in the on-chain `createAccount()` call (3–32 alphanumeric chars + underscores).

**Response 201:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "walletAddress": "0x...",
    "username": "alice_123",
    "rubbiBalance": "0"
  }
}
```

A virtual card is automatically created — no separate endpoint needed.

---

### POST /auth/login

No auth. Log in an existing user.

**Body:** `{ "walletAddress": "0x..." }`

**Response 200:** Same shape as register.

---

### GET /users/me

Auth required. Returns the current user profile.

```json
{
  "id": "uuid",
  "walletAddress": "0x...",
  "username": "alice_123",
  "rubbiBalance": "42.5",
  "card": {
    "id": "uuid",
    "issuerId": "sudo-card-id",
    "last4": "1234",
    "expiryMonth": "12",
    "expiryYear": "29",
    "status": "ACTIVE"
  }
}
```

`card` is `null` if no card exists (shouldn't happen with auto-creation).

---

### GET /cards/me

Auth required. Card summary.

```json
{
  "id": "uuid",
  "issuerId": "sudo-card-id",
  "last4": "1234",
  "expiryMonth": "12",
  "expiryYear": "29",
  "status": "ACTIVE",
  "rubbiBalance": "42.5"
}
```

### POST /cards/freeze

Auth required. Freeze the card.

**Body:** `{ "reason": "Lost card" }` (optional, 1–140 chars)

**Response:** `{ "status": "frozen" }`

### POST /cards/unfreeze

Auth required. Unfreeze the card.

**Body:** `{ "reason": "Found it" }` (optional, 1–140 chars)

**Response:** `{ "status": "active" }`

### GET /cards/me/number

Auth required. Reveals the full PAN (PCI-sensitive — use sparingly).

```json
{
  "cardId": "uuid",
  "pan": "4111111111111111",
  "last4": "1111",
  "expiryMonth": "12",
  "expiryYear": "29",
  "status": "ACTIVE"
}
```

---

### GET /deposits

Auth required. List deposits (most recent ~100).

```json
[
  {
    "id": "uuid",
    "txHash": "0x...",
    "amountRaw": "1000000000000000000",
    "amountRubbi": "1.0",
    "status": "CONFIRMED",
    "blockNumber": 123456,
    "confirmedAt": "2026-01-01T00:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

### GET /deposits/:txHash

Auth required. Get a specific deposit by transaction hash.

**Params:** `txHash` — hex string (`0x` + 64 hex chars)

---

### GET /transactions

Auth required. Paginated ledger.

**Query:** `?page=1&pageSize=20` (pageSize max 100, defaults to 20)

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 5,
  "items": [
    {
      "id": "uuid",
      "type": "DEPOSIT",
      "amountRubbi": "10.0",
      "balanceAfter": "50.0",
      "description": "Deposit confirmed",
      "metadata": { "txHash": "0x..." },
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

**Transaction types:** `DEPOSIT`, `SPEND`, `REFUND`, `SUBSCRIPTION_PAYMENT`, `FAUCET`

---

### GET /subscriptions/plans

Auth required. All active subscription plans from the contract.

```json
[
  { "planId": 1, "name": "Premium", "feeRubbi": "10.0", "active": true }
]
```

### GET /subscriptions/me

Auth required. User's active subscriptions from the contract.

```json
[
  { "active": true, "planName": "Premium", "feeRubbi": "10.0", "userAddress": "0x...", "planId": 1 }
]
```

### POST /subscriptions/start

Auth required. Confirm a user-signed `SubscriptionService.startSubscription(planId, email, pw)` transaction.

**Body:** `{ "planId": 1, "txHash": "0x..." }`

**Response 201:** `{ "txHash": "0x...", "verified": true }`

### POST /subscriptions/:planId/pause

Auth required. Confirm a user-signed `pauseSubscription(planId)` tx.

**Params:** `planId`, **Body:** `{ "txHash": "0x..." }`

**Response:** `{ "txHash": "0x...", "planId": 1, "verified": true }`

### POST /subscriptions/:planId/resume

Auth required. Confirm a user-signed `resumeSubscription(planId)` tx.

**Params:** `planId`, **Body:** `{ "txHash": "0x..." }`

**Response:** `{ "txHash": "0x...", "planId": 1, "verified": true }`

> **Pattern:** User signs the tx in their wallet → frontend posts the txHash → backend verifies on-chain receipt. The API never submits transactions.

---

### POST /faucet/claim

Auth required. Confirm a user-signed `RubbiToken.claimFaucet()` tx.

**Body:** `{ "txHash": "0x..." }`

**Response 201:** `{ "txHash": "0x...", "verified": true }`

### GET /faucet/cooldown

Auth required. Time remaining before next claim.

```json
{ "walletAddress": "0x...", "cooldownSeconds": 84321 }
```

---

### GET /salary-streaming/streams

Auth required. All daily and monthly salary streams.

```json
{
  "daily": [ /* StreamShape */ ],
  "monthly": [ /* StreamShape */ ]
}
```

### GET /salary-streaming/streams/:streamId

Auth required. Single stream.

**StreamShape:**

```json
{
  "id": "string",
  "recipient": "0x...",
  "amount": "1000000000000000000",
  "lastPayment": "0",
  "startTime": "1700000000",
  "intervalType": 0,
  "active": true,
  "name": "Monthly salary",
  "streamOwner": "0x..."
}
```

### GET /salary-streaming/fees

Auth required. Current contract streaming fees.

```json
{ "fees": "500000000000000000" }
```

### POST /salary-streaming/streams

Auth required. Confirm `SalaryStreaming.createStream(details, intervalType)` tx.

**Body:** `{ "txHash": "0x..." }`

**Response 201:** `{ "txHash": "0x...", "streamId": "1", "verified": true }`

### POST /salary-streaming/streams/:streamId/pause

Auth required. Confirm `pauseDailyStream(streamId)` or `pauseMonthlyStream(streamId)`.

**Body:** `{ "txHash": "0x..." }`

**Response:** `{ "txHash": "0x...", "streamId": 1, "verified": true }`

### POST /salary-streaming/streams/:streamId/resume

Auth required. Same pattern for resume.

### POST /salary-streaming/disburse

Auth required. Confirm `disburseDaily()` or `disburseMonthly()`.

**Body:** `{ "txHash": "0x..." }`

**Response 201:** `{ "txHash": "0x...", "verified": true }`

---

### POST /webhooks/card-issuer

No auth (HMAC). Sudo Africa card issuer webhook.

**Headers:** `x-sudo-signature` or `x-signature` — HMAC SHA-256 hex

**Supported events:**

- `authorization.request` — balance check (returns `"00"` approve or `"51"` decline)
- `card.charge` / `transaction.created` — deducts balance, records SPEND ledger entry
- `refund` / `reversal` — ignored

**Response:**

```json
// Authorization approved
{ "statusCode": 200, "data": { "responseCode": "00" }, "ok": true }

// Insufficient funds
{ "statusCode": 200, "data": { "responseCode": "51" } }

// Spend processed
{ "ok": true }

// Ignored event
{ "ok": true, "ignored": true, "reason": "Unsupported event type: refund" }

// Duplicate (within 24h)
{ "ok": true, "duplicate": true }
```

---

## Integration patterns

### The "user signs first" pattern

Endpoints for **subscriptions, salary streaming, and faucet** follow this flow:

1. Frontend calls the contract method via the user's wallet (e.g., `SubscriptionService.startSubscription(planId, email, pw)`)
2. Wallet returns a `txHash`
3. Frontend sends the `txHash` to the API
4. API verifies the transaction receipt on-chain and returns `{ verified: true }`

### The "on-chain event" pattern

**Deposits** are fully on-chain driven:

1. User sends RUBBI to `ModalContract.deposit(amount)`
2. The Arbitrum listener detects `DepositSuccessful`
3. A worker credits the user's balance, records the transaction, and funds their virtual card
4. Frontend polls `GET /deposits` or `GET /transactions` to show the update

### Smart contracts

| Contract | Env variable |
|---|---|
| RubbiToken | `RUBBI_TOKEN_ADDRESS` |
| ModalContract | `MODAL_CONTRACT_ADDRESS` |
| Authentication | `AUTH_CONTRACT_ADDRESS` |
| SubscriptionService | `SUBSCRIPTION_CONTRACT_ADDRESS` |
| SalaryStreaming | `SALARY_STREAMING_ADDRESS` |

All deployed on **Arbitrum** (chain ID `42161` or `421614` for Sepolia testnet).

---

## DB models (for reference)

**User:** id (UUID), walletAddress (unique), username, rubbiBalance (Decimal), card (1:1), deposits, transactions, subscriptions

**Card:** id (UUID), userId (unique FK), issuerId (Sudo ID), last4, expiryMonth, expiryYear, status (ACTIVE|FROZEN|TERMINATED)

**Deposit:** id (UUID), userId (FK), txHash (unique), amountRaw, amountRubbi, status (PENDING|CONFIRMED|FAILED), blockNumber

**Transaction:** id (UUID), userId (FK), type (DEPOSIT|SPEND|REFUND|SUBSCRIPTION_PAYMENT|FAUCET), amountRubbi, balanceAfter, description, metadata (JSON)

**Subscription:** id (UUID), userId (FK), onChainPlanId, planName, feeRubbi, status (ACTIVE|PAUSED|CANCELLED). Unique on `[userId, onChainPlanId]`.
