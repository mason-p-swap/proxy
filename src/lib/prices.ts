import { useEffect, useSyncExternalStore } from "react"
import { COIN_MAP } from "./mock-data"

const CG_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "ethereum",
  zXMR: "monero",
  XMR: "monero",
  USDT: "tether",
  USDC: "usd-coin",
  DAI: "dai",
}

let livePrices: Record<string, number> = {}
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Record<string, number> {
  return livePrices
}

async function refresh(): Promise<void> {
  try {
    const ids = [...new Set(Object.values(CG_IDS))].join(",")
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`)
    if (!res.ok) return
    const data = await res.json()
    const next: Record<string, number> = {}
    for (const [symbol, id] of Object.entries(CG_IDS)) {
      const usd = data?.[id]?.usd
      if (typeof usd === "number") next[symbol] = usd
    }
    if (Object.keys(next).length > 0) {
      livePrices = { ...livePrices, ...next }
      listeners.forEach((l) => l())
    }
  } catch {

  }
}

let started = false
function start(): void {
  if (started) return
  started = true
  refresh()
  setInterval(refresh, 60_000)
}

export function priceOf(symbol: string): number {
  return livePrices[symbol] ?? COIN_MAP[symbol]?.price ?? 0
}

export function usePrices(): (symbol: string) => number {
  useEffect(start, [])
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return priceOf
}
