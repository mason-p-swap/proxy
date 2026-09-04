export type Candle = { t: number; o: number; h: number; l: number; c: number }

export type Timeframe = "1D" | "1W" | "1M" | "3M"

const DAYS: Record<Timeframe, number> = { "1D": 1, "1W": 7, "1M": 30, "3M": 90 }
const POINTS: Record<Timeframe, number> = { "1D": 48, "1W": 84, "1M": 90, "3M": 90 }

const cache: Record<string, { at: number; data: Candle[] }> = {}
const TTL = 60_000

export async function fetchOhlc(tf: Timeframe, coinId: string | null): Promise<Candle[]> {
  const key = `${coinId ?? "synthetic"}:${tf}`
  const now = Date.now()
  const hit = cache[key]
  if (hit && now - hit.at < TTL) return hit.data

  if (!coinId) {
    const data = syntheticCandles(tf)
    cache[key] = { at: now, data }
    return data
  }

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${DAYS[tf]}`
  )
  if (!res.ok) throw new Error("price history unavailable")
  const json = await res.json()
  const data: Candle[] = (json ?? []).map((row: [number, number, number, number, number]) => ({
    t: row[0], o: row[1], h: row[2], l: row[3], c: row[4],
  }))
  cache[key] = { at: now, data }
  return data
}

function syntheticCandles(tf: Timeframe): Candle[] {
  const n = POINTS[tf]
  let seed = 0x9e3779b9 ^ (tf.charCodeAt(0) * 131 + tf.length)
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  const now = Date.now()
  const stepMs = (DAYS[tf] * 86_400_000) / n
  const out: Candle[] = []
  let price = 1
  for (let i = 0; i < n; i++) {
    const drift = (rand() - 0.47) * 0.03
    const o = price
    price = Math.max(0.2, price * (1 + drift))
    const c = price
    const h = Math.max(o, c) * (1 + rand() * 0.012)
    const l = Math.min(o, c) * (1 - rand() * 0.012)
    out.push({ t: now - (n - 1 - i) * stepMs, o, h, l, c })
  }
  return out
}
