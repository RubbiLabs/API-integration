import {
  CardDetails,
  CardResult,
  CreateCardParams,
  ICardIssuer,
  IssuerCardStatus,
} from "./index.js"

interface SudoAdapterOptions {
  apiKey: string
  baseUrl: string
}

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
interface JsonObject {
  [key: string]: JsonValue
}

function toIssuerStatus(status: string): IssuerCardStatus {
  const normalized = status.toUpperCase()
  if (normalized === "ACTIVE") return "ACTIVE"
  if (normalized === "FROZEN") return "FROZEN"
  return "TERMINATED"
}

export class SudoCardIssuer implements ICardIssuer {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(options: SudoAdapterOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl.replace(/\/$/, "")
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: JsonObject,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Sudo API ${response.status}: ${errorBody}`)
    }

    return (await response.json()) as T
  }

  async createVirtualCard(params: CreateCardParams): Promise<CardResult> {
    const payload = {
      type: params.type,
      currency: params.currency,
      holderName: params.holderName,
    }

    const data = await this.request<{
      data?: {
        id: string
        last4: string
        expiryMonth: string
        expiryYear: string
        status: string
      }
    }>("POST", "/cards/virtual", payload)

    if (!data.data) {
      throw new Error("Sudo API did not return card data")
    }

    return {
      id: data.data.id,
      last4: data.data.last4,
      expiryMonth: data.data.expiryMonth,
      expiryYear: data.data.expiryYear,
      status: toIssuerStatus(data.data.status),
    }
  }

  async fundCard(cardId: string, amountRubbi: string): Promise<void> {
    await this.request("POST", `/cards/${cardId}/fund`, {
      amount: amountRubbi,
      currency: "USD",
    })
  }

  async freezeCard(cardId: string): Promise<void> {
    await this.request("PUT", `/cards/${cardId}/freeze`)
  }

  async unfreezeCard(cardId: string): Promise<void> {
    await this.request("PUT", `/cards/${cardId}/unfreeze`)
  }

  async getCardDetails(cardId: string): Promise<CardDetails> {
    const data = await this.request<{
      data?: {
        id: string
        last4: string
        expiryMonth: string
        expiryYear: string
        status: string
        pan?: string
      }
    }>("GET", `/cards/${cardId}`)

    if (!data.data) {
      throw new Error("Sudo API did not return card details")
    }

    return {
      id: data.data.id,
      last4: data.data.last4,
      expiryMonth: data.data.expiryMonth,
      expiryYear: data.data.expiryYear,
      status: toIssuerStatus(data.data.status),
      pan: data.data.pan,
    }
  }
}
