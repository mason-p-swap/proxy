import { useState } from "react"
import { formatUnits } from "viem"
import { MARKET_ASSETS } from "@/lib/web3"
import {
  useMoneyMarket, pct, usdOf, type ReserveConfig,
} from "@/hooks/use-money-market"
import { DashShell, WalletBanner } from "@/components/dash-shell"
import { MarketActionModal, type ModalTarget } from "@/components/market-action-modal"
import { CryptoIcon } from "@/components/crypto-icon"
import { Switch } from "@/components/ui/switch"
import { fmtAmount, fmtUsd } from "@/lib/format"
import type { Route } from "@/lib/types"
import { Search, Droplets, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = { navigate: (to: Route) => void }

export function SupplyPage({ navigate }: Props) {
  const mm = useMoneyMarket()
  const [modal, setModal] = useState<ModalTarget>(null)
  const [query, setQuery] = useState("")

  const visible = MARKET_ASSETS.filter((a) => {
    const q = query.trim().toLowerCase()
    return !q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  })

  return (
    <DashShell active="supply" navigate={navigate}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Supply</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Supply an asset to earn its APY. Supplied assets count as collateral unless you switch them off.
        </p>
      </div>

      <WalletBanner mm={mm} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MARKET_ASSETS.map((a) => {
          const r = mm.reserves[a.key]
          const cfg = mm.configs[a.key]
          return (
            <div key={a.key} className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CryptoIcon symbol={a.icon} size={24} />
                  <div>
                    <div className="text-xs font-bold text-foreground">{a.symbol}</div>
                    <div className="text-[9px] text-muted-foreground">Sepolia</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums text-emerald-500">{r ? pct(r.supplyApr) : "…"}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">supply apy</div>
                </div>
              </div>
              <div className="mt-2">
                {cfg && r ? <RateCurve config={cfg} util={Number(formatUnits(r.util, 18))} /> : <div className="h-10" />}
              </div>
            </div>
          )
        })}
      </div>

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
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                {["Asset", "APY", "Wallet", "Your supply", "Total supplied", ""].map((c, i) => (
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
                    <td className="px-4 py-4 text-xs font-semibold tabular-nums text-emerald-500">
                      {r ? pct(r.supplyApr) : "…"}
                    </td>
                    <td className="px-4 py-4">
                      {mm.connected && u ? (
                        <div className="flex items-center gap-2.5">
                          <Stacked
                            top={`${fmtAmount(Number(formatUnits(u.walletBalance, a.decimals)))} ${a.symbol}`}
                            bottom={r ? fmtUsd(usdOf(u.walletBalance, a.decimals, r.price)) : ""}
                          />
                          <button
                            onClick={() => mm.mint(a.key)}
                            disabled={mm.busy !== null}
                            title={`mint test ${a.symbol}`}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                          >
                            {mm.busy === `mint-${a.key}` ? <Loader2 className="size-3 animate-spin" /> : <Droplets className="size-3" />}
                            mint
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {mm.connected && u && u.supplyBalance > 0n ? (
                        <div className="flex items-center gap-2.5">
                          <Stacked
                            top={`${fmtAmount(Number(formatUnits(u.supplyBalance, a.decimals)))} ${a.symbol}`}
                            bottom={r ? fmtUsd(usdOf(u.supplyBalance, a.decimals, r.price)) : ""}
                          />
                          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            collateral
                            <Switch
                              checked={u.usingAsCollateral}
                              disabled={mm.busy !== null}
                              onCheckedChange={(v) => mm.toggleCollateral(a.key, v)}
                            />
                          </label>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Stacked
                        top={r ? `${fmtAmount(Number(formatUnits(r.supplied, a.decimals)))} ${a.symbol}` : "…"}
                        bottom={r ? fmtUsd(usdOf(r.supplied, a.decimals, r.price)) : ""}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2.5">
                        {mm.connected && u && u.supplyBalance > 0n && (
                          <button
                            onClick={() => setModal({ asset: a.key, action: "withdraw" })}
                            className="rounded-full border border-border/60 px-3.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                          >
                            withdraw
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ asset: a.key, action: "supply" })}
                          disabled={!mm.connected}
                          className="rounded-full bg-foreground px-3.5 py-1.5 text-[11px] font-bold text-background transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          supply
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

function Stacked({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold tabular-nums text-foreground">{top}</span>
      {bottom && <span className="text-[10px] tabular-nums text-muted-foreground">{bottom}</span>}
    </div>
  )
}

export function RateCurve({ config, util }: { config: ReserveConfig; util: number }) {
  const rate = (u: number) =>
    u <= config.optimalUtil
      ? config.baseRate + (config.slope1 * u) / config.optimalUtil
      : config.baseRate + config.slope1 + (config.slope2 * (u - config.optimalUtil)) / (1 - config.optimalUtil)

  const W = 220, H = 40, PAD = 4
  const maxRate = Math.max(rate(1), 0.0001)
  const x = (u: number) => PAD + u * (W - 2 * PAD)
  const y = (r: number) => H - PAD - (r / maxRate) * (H - 2 * PAD)

  const points: string[] = []
  for (let i = 0; i <= 40; i++) {
    const u = i / 40
    points.push(`${x(u).toFixed(1)},${y(rate(u)).toFixed(1)}`)
  }
  const u0 = Math.max(0, Math.min(1, util))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <line
        x1={x(config.optimalUtil)} y1={PAD} x2={x(config.optimalUtil)} y2={H - PAD}
        className="stroke-border" strokeDasharray="2 3" strokeWidth="1"
      />
      <polyline points={points.join(" ")} fill="none" className={cn("stroke-muted-foreground/70")} strokeWidth="1.5" />
      <circle cx={x(u0)} cy={y(rate(u0))} r="3" className="fill-success" />
    </svg>
  )
}
