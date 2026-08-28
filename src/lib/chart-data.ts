export type Candle = { t: number; o: number; h: number; l: number; c: number }

export type Timeframe = "1D" | "1W" | "1M" | "3M"

const DAYS: Record<Timeframe, number> = { "1D": 1, "1W": 7, "1M": 30, "3M": 90 }

const cache: Partial<Record<Timeframe, { at: number; data: Candle[] }>> = {}
const TTL = 60_000

export async function fetchOhlc(tf: Timeframe): Promise<Candle[]> {
  const hit = cache[tf]
  const now = Date.now()
  if (hit && now - hit.at < TTL) return hit.data

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/monero/ohlc?vs_currency=usd&days=${DAYS[tf]}`
  )
  if (!res.ok) throw new Error("price history unavailable")
  const json = await res.json()
  const data: Candle[] = (json ?? []).map((row: [number, number, number, number, number]) => ({
    t: row[0], o: row[1], h: row[2], l: row[3], c: row[4],
  }))
  cache[tf] = { at: now, data }
  return data
}
