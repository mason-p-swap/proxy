import { useState } from "react"
import { cn } from "@/lib/utils"

const ICON_BASE =
  "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/icon"

const OVERRIDES: Record<string, string> = {
  busd: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/icon/usdc.png",
  weth: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/icon/eth.png",
  zxmr: "/zXMR_logo_256.png",
}

const TICKER_FALLBACK: Record<string, string> = {
  btc: "#f7931a",
  eth: "#627eea",
  sol: "#14f195",
  bnb: "#f3ba2f",
  xrp: "#23292f",
  usdt: "#26a17b",
  ada: "#0033ad",
  doge: "#c2a633",
  dot: "#e6007a",
  matic: "#8247e5",
  link: "#2a5ada",
  avax: "#e84142",
  uni: "#ff007a",
  ltc: "#a6a9aa",
  atom: "#2e3148",
  trx: "#ff060a",
  dai: "#f5ac37",
  busd: "#f0b90b",
  usdc: "#2775ca",
  wbtc: "#f09242",
  weth: "#627eea",
  xmr: "#ff6600",
  zxmr: "#f5883e",
}

type Props = {
  symbol: string
  size?: number
  className?: string
}

const MAX_RETRIES = 2

export function CryptoIcon({ symbol, size = 24, className }: Props) {
  const [attempt, setAttempt] = useState(0)
  const sym = symbol.toLowerCase()
  const color = TICKER_FALLBACK[sym] ?? "#888"

  if (attempt > MAX_RETRIES || !sym) {
    return (
      <div
        className={cn("flex shrink-0 items-center justify-center rounded-full font-bold uppercase", className)}
        style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36, color: "#fff" }}
      >
        {sym.slice(0, 3)}
      </div>
    )
  }

  const base = OVERRIDES[sym] ?? `${ICON_BASE}/${sym}.png`
  const src = attempt === 0 ? base : `${base}${base.includes("?") ? "&" : "?"}retry=${attempt}`

  return (
    <img
      key={src}
      src={src}
      alt={symbol}
      width={size}
      height={size}
      onError={() => setAttempt((a) => a + 1)}
      className={cn("shrink-0 rounded-full object-cover", className)}
      style={{ width: size, height: size }}
    />
  )
}
