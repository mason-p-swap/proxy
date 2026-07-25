import { useState } from "react"
import { COINS } from "@/lib/mock-data"
import { usePrices } from "@/lib/prices"
import { fmtUsd } from "@/lib/format"
import { CryptoIcon } from "@/components/crypto-icon"
import { Search, ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react"
import type { Route } from "@/lib/types"
import { cn } from "@/lib/utils"

const CHANGES: Record<string, { pct: number; vol: number }> = {
  BTC: { pct: 2.34, vol: 28.4 }, ETH: { pct: 1.87, vol: 14.2 }, SOL: { pct: 5.12, vol: 42.8 },
  BNB: { pct: -0.54, vol: 8.1 }, XRP: { pct: 0.82, vol: 3.2 }, USDT: { pct: 0.01, vol: 0.1 },
  USDC: { pct: 0.0, vol: 0.05 }, ADA: { pct: -1.23, vol: 5.4 }, DOGE: { pct: 3.45, vol: 22.1 },
  MATIC: { pct: 1.45, vol: 6.8 }, LINK: { pct: 2.91, vol: 11.3 },
  AVAX: { pct: -2.14, vol: 9.5 }, LTC: { pct: 0.34, vol: 2.8 }, ATOM: { pct: 1.12, vol: 3.9 },
  TRX: { pct: 0.22, vol: 1.4 }, DAI: { pct: 0.0, vol: 0.08 },
  UNI: { pct: 4.23, vol: 7.6 }, ARB: { pct: -3.21, vol: 12.4 },
}

function Sparkline({ pct }: { pct: number }) {
  const bars = 12
  const trend = pct / 100
  return (
    <div className="flex h-6 items-end gap-[2px]">
      {Array.from({ length: bars }).map((_, i) => {
        const wave = Math.sin(i * 0.6 + pct) * 0.3 + 1
        const h = 30 + (i / bars) * 40 * trend * wave + 30
        return (
          <div
            key={i}
            className={cn("w-[2px] rounded-full", pct >= 0 ? "bg-emerald-500/70" : "bg-red-500/70")}
            style={{ height: `${Math.max(10, Math.min(100, h))}%` }}
          />
        )
      })}
    </div>
  )
}

type Props = { navigate: (to: Route) => void }

export function MarketsPage({ navigate }: Props) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"vol" | "price" | "change">("vol")
  const priceOf = usePrices()

  const q = query.toLowerCase().trim()
  const filtered = COINS.filter(
    (c) => !q || c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).sort((a, b) => {
    if (sort === "price") return priceOf(b.symbol) - priceOf(a.symbol)
    if (sort === "change") return (CHANGES[b.symbol]?.pct ?? 0) - (CHANGES[a.symbol]?.pct ?? 0)
    return (CHANGES[b.symbol]?.vol ?? 0) - (CHANGES[a.symbol]?.vol ?? 0)
  })

  const totalMcap = COINS.reduce((s, c) => s + priceOf(c.symbol) * 1e7, 0)

  return (
    <div className="relative min-h-svh overflow-hidden pt-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-white opacity-[0.04] blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10" style={{ animation: "fade-in-up 0.5s ease-out" }}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Markets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live prices across {COINS.length} supported assets. Choose any coin to start an exchange.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: "Total Market Cap", value: fmtUsd(totalMcap, { compact: true }) },
            { label: "24h Volume", value: fmtUsd(1.84e9, { compact: true }) },
            { label: "Active Coins", value: String(COINS.length) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-foreground">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background/50 px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search coin or name..."
              className="h-5 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-input bg-background/50 p-1">
            {(["vol", "price", "change"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                  sort === s ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "vol" ? "Volume" : s === "price" ? "Price" : "Change"}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-border/60 px-4 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground md:grid">
          <span>Asset</span>
          <span className="text-right">Price</span>
          <span className="text-right">24h Change</span>
          <span>Chart</span>
          <span className="w-8" />
        </div>

        <div className="divide-y divide-border/40">
          {filtered.map((c) => {
            const change = CHANGES[c.symbol] ?? { pct: 0, vol: 0 }
            const up = change.pct >= 0
            return (
              <div
                key={c.symbol}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.03] md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
              >
                <div className="flex items-center gap-3">
                  <CryptoIcon symbol={c.symbol} size={28} />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">{c.symbol}</span>
                    <span className="text-[10px] text-muted-foreground">{c.name}</span>
                  </div>
                </div>

                <div className="hidden text-right md:block">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {fmtUsd(priceOf(c.symbol))}
                  </span>
                </div>

                <div className="hidden items-center justify-end gap-1 md:flex">
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-xs font-semibold tabular-nums",
                      up ? "text-emerald-500" : "text-red-500"
                    )}
                  >
                    {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {Math.abs(change.pct).toFixed(2)}%
                  </span>
                </div>

                <div className="hidden md:block">
                  <Sparkline pct={change.pct} />
                </div>

                <button
                  onClick={() => navigate({ name: "home" })}
                  className="ml-auto flex size-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  aria-label={`Exchange ${c.symbol}`}
                >
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No coins found</div>
          )}
        </div>
      </div>
    </div>
  )
}
