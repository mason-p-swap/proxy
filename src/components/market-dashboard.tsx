import { formatUnits } from "viem"
import { ADDR_V2, EXPLORER, MARKET_ASSETS } from "@/lib/web3"
import { useMoneyMarket, pct, hfDisplayOf, hfColorOf } from "@/hooks/use-money-market"
import { CryptoIcon } from "@/components/crypto-icon"
import { fmtAmount, fmtUsd } from "@/lib/format"
import { ExternalLink, LayoutDashboard } from "lucide-react"
import type { Route } from "@/lib/types"
import { cn } from "@/lib/utils"

export function MarketDashboard({ navigate }: { navigate: (to: Route) => void }) {
  const mm = useMoneyMarket()

  return (
    <div className="mb-12">
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Value Locked", value: fmtUsd(mm.stats.tvl, { compact: true }) },
          { label: "Total Borrowed", value: fmtUsd(mm.stats.borrowed, { compact: true }) },
          { label: "Available Liquidity", value: fmtUsd(mm.stats.liquidity, { compact: true }) },
          { label: "Health Factor", value: hfDisplayOf(mm.hf), className: hfColorOf(mm.hf) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className={cn("mt-1 text-lg font-bold tabular-nums text-foreground", s.className)}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight text-foreground">Markets</h2>
        <span className="flex items-center gap-1.5 rounded-sm border border-success/50 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
          <span className="size-1.5 animate-pulse rounded-full bg-success" />
          live on sepolia
        </span>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => navigate({ name: "dashboard" })}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-foreground/30"
          >
            <LayoutDashboard className="size-3.5" />
            your dashboard
          </button>
          <a
            href={`${EXPLORER}/address/${ADDR_V2.market}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            contract <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
        <div className="hidden grid-cols-[1.6fr_1fr_1.2fr_1fr_1.2fr_1fr_auto] gap-3 border-b border-border/60 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground lg:grid">
          <span>Asset</span>
          <span className="text-right">Price</span>
          <span className="text-right">Supplied</span>
          <span className="text-right">Supply APY</span>
          <span className="text-right">Borrowed</span>
          <span className="text-right">Borrow APY</span>
          <span className="w-[132px]" />
        </div>

        <div className="divide-y divide-border/40">
          {MARKET_ASSETS.map((a) => {
            const r = mm.reserves[a.key]
            return (
              <div
                key={a.key}
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.02] lg:grid-cols-[1.6fr_1fr_1.2fr_1fr_1.2fr_1fr_auto]"
              >
                <div className="flex items-center gap-3">
                  <CryptoIcon symbol={a.icon} size={28} />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">{a.symbol}</span>
                    <span className="text-[10px] text-muted-foreground">{a.name}</span>
                  </div>
                </div>
                <div className="hidden text-right text-xs font-semibold tabular-nums lg:block">
                  {r ? fmtUsd(Number(r.price) / 1e8) : "…"}
                </div>
                <div className="hidden text-right text-xs tabular-nums text-muted-foreground lg:block">
                  {r ? fmtAmount(Number(formatUnits(r.supplied, a.decimals))) : "…"}
                </div>
                <div className="hidden text-right text-xs font-semibold tabular-nums text-emerald-500 lg:block">
                  {r ? pct(r.supplyApr) : "…"}
                </div>
                <div className="hidden text-right text-xs tabular-nums text-muted-foreground lg:block">
                  {r ? fmtAmount(Number(formatUnits(r.borrowed, a.decimals))) : "…"}
                </div>
                <div className="hidden text-right text-xs font-semibold tabular-nums lg:block">
                  {r ? pct(r.borrowApr) : "…"}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => navigate({ name: "supply" })}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Supply
                  </button>
                  <button
                    onClick={() => navigate({ name: "borrow" })}
                    className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    Borrow
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
