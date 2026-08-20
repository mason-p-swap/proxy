export type Coin = {
  symbol: string
  name: string
  network: string
  icon: string
  price: number
  minAmount: number
  maxAmount: number
}

export type RateType = "float" | "fixed"

export type SwapQuote = {
  fromSymbol: string
  toSymbol: string
  fromAmount: number
  toAmount: number
  rate: number
  fee: number
  feePercent: number
  rateType: RateType
  expiresAt: number
}

export type ExchangeStatus =
  | "awaiting"
  | "confirming"
  | "exchanging"
  | "sending"
  | "done"
  | "expired"
  | "failed"

export type Exchange = {
  id: string
  fromSymbol: string
  toSymbol: string
  fromAmount: number
  toAmount: number
  rate: number
  rateType: RateType
  depositAddress: string

  payinExtraId?: string
  destinationAddress: string
  status: ExchangeStatus
  createdAt: number
  expiresAt: number
  txIdFrom?: string
  txIdTo?: string
}

export type Route =
  | { name: "home" }
  | { name: "markets" }
  | { name: "defi" }
  | { name: "dashboard" }
  | { name: "supply" }
  | { name: "borrow" }
  | { name: "docs" }
  | { name: "sim" }
  | { name: "faq" }
  | { name: "how" }
