export type OrderSide = "buy" | "sell"
export type OrderStatus = "open" | "filled" | "cancelled" | "expired"

export type LimitOrder = {
  id: string
  side: OrderSide
  base: string
  quote: string
  amount: number
  limitPrice: number
  status: OrderStatus
  createdAt: number
  filledAt?: number
  expiresAt?: number
}

const STORAGE_KEY = "proxyswap.limitorders.v1"

function loadAll(): LimitOrder[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    return []
  }
}

function persistAll(orders: LimitOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch {
    /* storage unavailable */
  }
}

function code(): string {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `LO-${part()}`
}

export function createLimitOrder(params: {
  side: OrderSide
  base: string
  quote: string
  amount: number
  limitPrice: number
  expiresAt?: number
}): LimitOrder {
  const order: LimitOrder = {
    id: code(),
    side: params.side,
    base: params.base,
    quote: params.quote,
    amount: params.amount,
    limitPrice: params.limitPrice,
    status: "open",
    createdAt: Date.now(),
    expiresAt: params.expiresAt,
  }
  const all = loadAll()
  all.push(order)
  persistAll(all)
  return order
}

export function cancelOrder(id: string): void {
  const all = loadAll()
  const o = all.find((x) => x.id === id)
  if (o && o.status === "open") o.status = "cancelled"
  persistAll(all)
}

export function syncFills(base: string, currentPrice: number): LimitOrder[] {
  const all = loadAll()
  const now = Date.now()
  let changed = false
  for (const o of all) {
    if (o.status !== "open") continue
    if (o.expiresAt && now >= o.expiresAt) {
      o.status = "expired"
      changed = true
      continue
    }
    if (o.base !== base) continue
    const hit = o.side === "buy" ? currentPrice <= o.limitPrice : currentPrice >= o.limitPrice
    if (hit) {
      o.status = "filled"
      o.filledAt = now
      changed = true
    }
  }
  if (changed) persistAll(all)
  return [...all].sort((a, b) => b.createdAt - a.createdAt)
}

export function listOrders(base?: string): LimitOrder[] {
  const all = base ? loadAll().filter((o) => o.base === base) : loadAll()
  return [...all].sort((a, b) => b.createdAt - a.createdAt)
}
