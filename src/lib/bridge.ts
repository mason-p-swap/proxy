export type BridgeStatus =
  | "awaiting_deposit"
  | "confirming"
  | "exchanging"
  | "sending"
  | "completed"
  | "expired"

export type BridgeOrder = {
  id: string
  fromSymbol: string
  toSymbol: string
  fromAmount: string
  toAmount: string
  depositAsset: string
  depositAddress: string
  payoutAddress: string
  status: BridgeStatus
  createdAt: number
  updatedAt: number
  txPayout?: string
}

export type BridgeQuote = {
  toAmount: number
  rate: number
  feePct: number
}

export type CreateOrderParams = {
  fromSymbol: string
  toSymbol: string
  fromAmount: string
  payoutAddress: string
}

export const BRIDGE_FEE_PCT = 1.0
export const BRIDGE_IS_LIVE = false

const BRIDGE_INTAKE_EVM = "0x000000000000000000000000000000000000dEaD"
const BRIDGE_INTAKE_XMR =
  "88bridgEdemoMoneroDepositAddressDoNotSendRealFundsXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXY1Qb2Zc"

const USD_PRICE: Record<string, number> = {
  XMR: 283,
  zXMR: 283,
  ETH: 3520,
  WETH: 3520,
  USDC: 1,
  USDT: 1,
  DAI: 1,
}

const STORAGE_KEY = "proxyswap.bridge.orders.v1"
const STAGE_MS = 7000
const STAGES: BridgeStatus[] = ["awaiting_deposit", "confirming", "exchanging", "sending", "completed"]

function loadAll(): Record<string, BridgeOrder> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function persistAll(all: Record<string, BridgeOrder>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable */
  }
}

function simulatedStatus(createdAt: number): BridgeStatus {
  const stage = Math.floor((Date.now() - createdAt) / STAGE_MS)
  return STAGES[Math.min(Math.max(stage, 0), STAGES.length - 1)]
}

function orderCode(): string {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `PS-${part()}-${part()}`
}

export function quoteBridge(fromSymbol: string, toSymbol: string, amountIn: number): BridgeQuote {
  const usdIn = amountIn * (USD_PRICE[fromSymbol] ?? 0)
  const gross = USD_PRICE[toSymbol] ? usdIn / USD_PRICE[toSymbol] : 0
  const toAmount = gross * (1 - BRIDGE_FEE_PCT / 100)
  return { toAmount, rate: amountIn > 0 ? toAmount / amountIn : 0, feePct: BRIDGE_FEE_PCT }
}

export async function createBridgeOrder(params: CreateOrderParams): Promise<BridgeOrder> {
  const quote = quoteBridge(params.fromSymbol, params.toSymbol, parseFloat(params.fromAmount) || 0)
  const now = Date.now()
  const fromXmr = params.fromSymbol === "XMR"
  const order: BridgeOrder = {
    id: orderCode(),
    fromSymbol: params.fromSymbol,
    toSymbol: params.toSymbol,
    fromAmount: params.fromAmount,
    toAmount: quote.toAmount.toFixed(6),
    depositAsset: params.fromSymbol,
    depositAddress: fromXmr ? BRIDGE_INTAKE_XMR : BRIDGE_INTAKE_EVM,
    payoutAddress: params.payoutAddress,
    status: "awaiting_deposit",
    createdAt: now,
    updatedAt: now,
  }
  const all = loadAll()
  all[order.id] = order
  persistAll(all)
  return order
}

export async function getBridgeOrder(id: string): Promise<BridgeOrder | null> {
  const all = loadAll()
  const order = all[id]
  if (!order) return null
  const status = simulatedStatus(order.createdAt)
  if (status !== order.status) {
    order.status = status
    order.updatedAt = Date.now()
    if (status === "completed" && !order.txPayout) {
      order.txPayout = `mock:${order.id.toLowerCase()}`
    }
    all[id] = order
    persistAll(all)
  }
  return order
}

export async function listBridgeOrders(): Promise<BridgeOrder[]> {
  const all = loadAll()
  const ids = Object.keys(all)
  for (const id of ids) {
    await getBridgeOrder(id)
  }
  return Object.values(loadAll()).sort((a, b) => b.createdAt - a.createdAt)
}

export const BRIDGE_STATUS_LABEL: Record<BridgeStatus, string> = {
  awaiting_deposit: "Awaiting deposit",
  confirming: "Confirming deposit",
  exchanging: "Exchanging",
  sending: "Sending Monero",
  completed: "Completed",
  expired: "Expired",
}
