export type Candle = { t: number; p: number }

export type Timeframe = "1D" | "1W" | "1M" | "3M"

const DAYS: Record<Timeframe, number> = { "1D": 1, "1W": 7, "1M": 30, "3M": 90 }

const cache: Partial<Record<Timeframe, { at: number; data: Candle[] }>> = {}
const TTL = 60_000

export async function fetchPriceHistory(tf: Timeframe): Promise<Candle[]> {
  const hit = cache[tf]
  const now = Date.now()
  if (hit && now - hit.at < TTL) return hit.data

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/monero/market_chart?vs_currency=usd&days=${DAYS[tf]}`
  )
  if (!res.ok) throw new Error("price history unavailable")
  const json = await res.json()
  const data: Candle[] = (json.prices ?? []).map((row: [number, number]) => ({ t: row[0], p: row[1] }))
  cache[tf] = { at: now, data }
  return data
}
