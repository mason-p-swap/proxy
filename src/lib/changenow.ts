import type { Exchange, ExchangeStatus } from "./types"

const V1 = "https://api.changenow.io/v1"
const V2 = "https://api.changenow.io/v2"

const API_KEY = (import.meta.env.VITE_CHANGENOW_API_KEY as string | undefined)?.trim()

export const hasApiKey = Boolean(API_KEY)

export const CN_TICKER: Record<string, string> = {
  BTC: "btc",
  ETH: "eth",
  SOL: "sol",
  BNB: "bnbbsc",
  XRP: "xrp",
  USDT: "usdttrc20",
  USDC: "usdc",
  ADA: "ada",
  DOGE: "doge",
  MATIC: "matic",
  LINK: "link",
  AVAX: "avax",
  LTC: "ltc",
  ATOM: "atom",
  TRX: "trx",
  DAI: "dai",
  UNI: "uni",
  ARB: "arb",
}

const SYMBOL_BY_TICKER: Record<string, string> = Object.fromEntries(
  Object.entries(CN_TICKER).map(([sym, ticker]) => [ticker, sym])
)

export class ChangeNowError extends Error {}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ChangeNowError(humanizeError(body) ?? `request failed (${res.status})`)
  }
  return body
}

function humanizeError(body: any): string | null {
  const code = body?.error ?? body?.message
  if (!code) return null
  switch (code) {
    case "not_valid_address":
      return "that destination address isn't valid for the selected coin"
    case "out_of_range":
    case "deposit_too_small":
      return "amount is outside the allowed range for this pair"
    case "pair_is_inactive":
      return "this pair is temporarily unavailable"
    case "not_valid_params":
      return "invalid swap parameters — check the amount and address"
    default:
      return typeof body?.message === "string" ? body.message : String(code)
  }
}

export async function fetchMinAmount(fromSymbol: string, toSymbol: string): Promise<number> {
  const body = await getJson(`${V1}/min-amount/${CN_TICKER[fromSymbol]}_${CN_TICKER[toSymbol]}`)
  return Number(body.minAmount)
}

export type Quote = {
  toAmount: number

  speedForecast: string | null
  warning: string | null
}

export async function fetchEstimate(
  fromSymbol: string,
  toSymbol: string,
  fromAmount: number
): Promise<Quote> {
  const body = await getJson(
    `${V1}/exchange-amount/${fromAmount}/${CN_TICKER[fromSymbol]}_${CN_TICKER[toSymbol]}`
  )
  return {
    toAmount: Number(body.estimatedAmount),
    speedForecast: body.transactionSpeedForecast ?? null,
    warning: body.warningMessage ?? null,
  }
}

export type AddressCheck = {
  ok: boolean
  message: string | null

  needsExtraId: boolean
}

export async function validateAddress(symbol: string, address: string): Promise<AddressCheck> {
  try {
    const res = await fetch(
      `${V2}/validate/address?currency=${CN_TICKER[symbol]}&address=${encodeURIComponent(address)}`
    )
    const body = await res.json().catch(() => null)
    if (!body || typeof body.result !== "boolean") return { ok: true, message: null, needsExtraId: false }
    const needsExtraId = body.result === false && /extra id/i.test(body.message ?? "")
    return { ok: body.result, message: body.message ?? null, needsExtraId }
  } catch {

    return { ok: true, message: null, needsExtraId: false }
  }
}

const STATUS_MAP: Record<string, ExchangeStatus> = {
  new: "awaiting",
  waiting: "awaiting",
  confirming: "confirming",
  exchanging: "exchanging",
  verifying: "exchanging",
  sending: "sending",
  finished: "done",
  failed: "failed",
  refunded: "failed",
  expired: "expired",
}

export async function createExchange(params: {
  fromSymbol: string
  toSymbol: string
  fromAmount: number
  destinationAddress: string
  extraId?: string
}): Promise<Exchange> {
  if (!API_KEY) throw new ChangeNowError("live swaps need a ChangeNOW API key (see .env.example)")
  const res = await fetch(`${V1}/transactions/${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: CN_TICKER[params.fromSymbol],
      to: CN_TICKER[params.toSymbol],
      amount: String(params.fromAmount),
      address: params.destinationAddress,
      extraId: params.extraId ?? "",
    }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.id || !body?.payinAddress) {
    throw new ChangeNowError(humanizeError(body) ?? "could not create the swap — try again")
  }
  const toAmount = Number(body.amount) || 0
  const order: Exchange = {
    id: body.id,
    fromSymbol: params.fromSymbol,
    toSymbol: params.toSymbol,
    fromAmount: params.fromAmount,
    toAmount,
    rate: params.fromAmount > 0 ? toAmount / params.fromAmount : 0,
    rateType: "float",
    depositAddress: body.payinAddress,
    payinExtraId: body.payinExtraId || undefined,
    destinationAddress: params.destinationAddress,
    status: "awaiting",
    createdAt: Date.now(),

    expiresAt: 0,
  }
  saveOrder(order)
  return order
}

export async function fetchOrderUpdate(id: string): Promise<Exchange | null> {
  if (!API_KEY) return null
  const body = await getJson(`${V1}/transactions/${encodeURIComponent(id)}/${API_KEY}`)
  if (!body?.id) return null
  const stored = getStoredOrder(id)
  const fromSymbol =
    stored?.fromSymbol ?? SYMBOL_BY_TICKER[body.fromCurrency] ?? String(body.fromCurrency ?? "?").toUpperCase()
  const toSymbol =
    stored?.toSymbol ?? SYMBOL_BY_TICKER[body.toCurrency] ?? String(body.toCurrency ?? "?").toUpperCase()
  const fromAmount = Number(body.amountSend) || Number(body.expectedSendAmount) || stored?.fromAmount || 0
  const toAmount = Number(body.amountReceive) || Number(body.expectedReceiveAmount) || stored?.toAmount || 0
  const order: Exchange = {
    id: body.id,
    fromSymbol,
    toSymbol,
    fromAmount,
    toAmount,
    rate: fromAmount > 0 ? toAmount / fromAmount : stored?.rate ?? 0,
    rateType: "float",
    depositAddress: body.payinAddress ?? stored?.depositAddress ?? "",
    payinExtraId: body.payinExtraId || stored?.payinExtraId,
    destinationAddress: body.payoutAddress ?? stored?.destinationAddress ?? "",
    status: STATUS_MAP[body.status] ?? stored?.status ?? "awaiting",
    createdAt: stored?.createdAt ?? (body.createdAt ? Date.parse(body.createdAt) : Date.now()),
    expiresAt: stored?.expiresAt ?? 0,
    txIdFrom: body.payinHash || stored?.txIdFrom,
    txIdTo: body.payoutHash || stored?.txIdTo,
  }
  saveOrder(order)
  return order
}

const ORDERS_KEY = "proxyswap.orders.v1"

function readOrders(): Record<string, Exchange> {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "{}")
  } catch {
    return {}
  }
}

export function getStoredOrder(id: string): Exchange | null {
  return readOrders()[id] ?? null
}

export function saveOrder(order: Exchange): void {
  const orders = readOrders()
  orders[order.id] = order
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  } catch {

  }
}
