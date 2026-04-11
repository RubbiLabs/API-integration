export type IssuerCardStatus = "ACTIVE" | "FROZEN" | "TERMINATED"

export interface CreateCardParams {
  holderName: string
  currency: "USD"
  type: "virtual"
}

export interface CardResult {
  id: string
  last4: string
  expiryMonth: string
  expiryYear: string
  status: IssuerCardStatus
}

export interface CardDetails {
  id: string
  last4: string
  expiryMonth: string
  expiryYear: string
  status: IssuerCardStatus
  pan?: string
}

export interface ICardIssuer {
  createVirtualCard(params: CreateCardParams): Promise<CardResult>
  fundCard(cardId: string, amountRubbi: string): Promise<void>
  freezeCard(cardId: string): Promise<void>
  unfreezeCard(cardId: string): Promise<void>
  getCardDetails(cardId: string): Promise<CardDetails>
}
