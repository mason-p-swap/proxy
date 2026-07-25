import { useState } from "react"
import { formatUnits } from "viem"
import { MARKET_ASSETS } from "@/lib/web3"
import { useMoneyMarket, pct, usdOf, hfDisplayOf, hfColorOf } from "@/hooks/use-money-market"
import { DashShell, WalletBanner } from "@/components/dash-shell"
import { MarketActionModal, type ModalTarget } from "@/components/market-action-modal"
import { CryptoIcon } from "@/components/crypto-icon"
import { fmtAmount, fmtUsd } from "@/lib/format"
import type { Route } from "@/lib/types"
import { Search, Skull } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = { navigate: (to: Route) => void }

export function BorrowPage({ navigate }: Props) {
  const mm = useMoneyMarket()
  const [modal, setModal] = useState<ModalTarget>(null)
  const [query, setQuery] = useState("")

  const visible = MARKET_ASSETS.filter((a) => {
    const q = query.trim().toLowerCase()
    return !q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  })

  return (
    <DashShell active="borrow" navigate={navigate}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Borrow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Borrow any listed asset against your combined collateral — up to each asset&apos;s loan-to-value.
        </p>
      </div>

      <WalletBanner mm={mm} />

      {mm.connected && mm.accountData && (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Available to Borrow</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-foreground">
              {fmtUsd(Number(formatUnits(mm.accountData.availableUsd, 18)))}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Health Factor</div>
            <div className={cn("mt-1 text-lg font-bold tabular-nums", hfColorOf(mm.hf))}>{hfDisplayOf(mm.hf)}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>borrow power used</span>
              <span className="tabular-nums">{mm.powerUsedPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  mm.powerUsedPct < 60 ? "bg-success" : mm.powerUsedPct < 85 ? "bg-warning" : "bg-destructive"
                )}
                style={{ width: `${mm.powerUsedPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {mm.connected && mm.liquidatable && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <Skull className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-bold text-destructive">health factor below 1.0 — this position is liquidatable.</span>{" "}
            repay debt or supply more collateral before borrowing anything else.
          </p>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 rounded-full border border-input bg-background/50 px-4 py-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter assets..."
          className="h-5 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr>
                {["Asset", "APY", "Your debt", "Total borrowed", "Available liquidity", ""].map((c, i) => (
                  <th key={i} className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const r = mm.reserves[a.key]
                const u = mm.userReserves[a.key]
                return (
                  <tr key={a.key} className="border-t border-border/40 transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <CryptoIcon symbol={a.icon} size={32} />
                        <div>
                          <div className="text-sm font-bold text-foreground">{a.name}</div>
                          <div className="text-[10px] text-muted-foreground">{a.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs font-semibold tabular-nums text-foreground">
                      {r ? pct(r.borrowApr) : "…"}
                    </td>
                    <td className="px-4 py-4">
                      {mm.connected && u && u.debtBalance > 0n ? (
                        <Stacked
                          top={`${fmtAmount(Number(formatUnits(u.debtBalance, a.decimals)))} ${a.symbol}`}
                          bottom={r ? fmtUsd(usdOf(u.debtBalance, a.decimals, r.price)) : ""}
                          warn
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Stacked
                        top={r ? `${fmtAmount(Number(formatUnits(r.borrowed, a.decimals)))} ${a.symbol}` : "…"}
                        bottom={r ? fmtUsd(usdOf(r.borrowed, a.decimals, r.price)) : ""}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <Stacked
                        top={r ? `${fmtAmount(Number(formatUnits(r.liquidity, a.decimals)))} ${a.symbol}` : "…"}
                        bottom={r ? fmtUsd(usdOf(r.liquidity, a.decimals, r.price)) : ""}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2.5">
                        {mm.connected && u && u.debtBalance > 0n && (
                          <button
                            onClick={() => setModal({ asset: a.key, action: "repay" })}
                            className="rounded-full border border-border/60 px-3.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                          >
                            repay
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ asset: a.key, action: "borrow" })}
                          disabled={!mm.connected || !mm.accountData || mm.accountData.availableUsd === 0n || !r || r.liquidity === 0n}
                          className="rounded-full bg-foreground px-3.5 py-1.5 text-[11px] font-bold text-background transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          borrow
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <MarketActionModal target={modal} onClose={() => setModal(null)} mm={mm} />
    </DashShell>
  )
}

function Stacked({ top, bottom, warn }: { top: string; bottom: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={cn("text-xs font-semibold tabular-nums text-foreground", warn && "text-warning")}>{top}</span>
      {bottom && <span className="text-[10px] tabular-nums text-muted-foreground">{bottom}</span>}
    </div>
  )
}
