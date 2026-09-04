import { useState } from "react"
import { CryptoIcon } from "@/components/crypto-icon"
import { Slider } from "@/components/ui/slider"
import { fmtUsd, fmtAmount } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  INITIAL_SIM,
  SIM_PARAMS,
  accrueOneYear,
  availableLiquidity,
  borrowRate,
  collateralValue,
  healthFactor,
  liquidate,
  liquidationPrice,
  ltv,
  maxBorrowable,
  riskLevel,
  supplyRate,
  utilization,
  type SimState,
} from "@/lib/defi-sim"
import { Clock, Zap, RotateCcw, TrendingDown } from "lucide-react"
import { toast } from "sonner"

const RISK_META = {
  none: { label: "No loan", tone: "text-muted-foreground", dot: "bg-muted-foreground" },
  safe: { label: "Safe", tone: "text-success", dot: "bg-success" },
  risky: { label: "Getting risky", tone: "text-warning", dot: "bg-warning" },
  danger: { label: "Liquidatable!", tone: "text-red-500", dot: "bg-red-500" },
} as const

function hfColor(hf: number): string {
  if (hf >= 1.5) return "text-success"
  if (hf >= 1) return "text-warning"
  return "text-red-500"
}

function HealthGauge({ hf }: { hf: number }) {

  const shown = hf === Infinity ? 3 : Math.min(3, hf)
  const pct = (shown / 3) * 100
  const dangerPct = (1 / 3) * 100
  const color = hf >= 1.5 ? "bg-success" : hf >= 1 ? "bg-warning" : "bg-red-500"

  return (
    <div className="mt-3">
      <div className="relative h-2 w-full rounded-full bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-300", color)}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-[-3px] w-px bg-red-500/70"
          style={{ left: `${dangerPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
        <span>0</span>
        <span className="text-red-500/70" style={{ marginLeft: "-8%" }}>
          1.0 · liquidation
        </span>
        <span>3.0+</span>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  valueClass,
  sub,
}: {
  label: string
  value: string
  valueClass?: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-bold tabular-nums text-foreground", valueClass)}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function SimulatorPage() {
  const [sim, setSim] = useState<SimState>(INITIAL_SIM)

  const set = (patch: Partial<SimState>) => setSim((s) => ({ ...s, ...patch }))

  const cv = collateralValue(sim)
  const hf = healthFactor(sim)
  const risk = riskLevel(sim)
  const meta = RISK_META[risk]
  const liqPrice = liquidationPrice(sim)
  const maxBorrow = maxBorrowable(sim)
  const canLiquidate = hf < 1

  const handleAccrue = () => {
    const next = accrueOneYear(sim)
    const interest = next.bobDebt - sim.bobDebt
    setSim(next)
    toast.success(`One year later`, {
      description: `Bob paid ${fmtUsd(interest)} interest — all of it earned by Alice.`,
    })
  }

  const handleLiquidate = () => {
    const result = liquidate(sim)
    if (result.repaid === 0) return
    setSim(result.state)
    toast.success("Bob was liquidated", {
      description: `A liquidator repaid ${fmtUsd(result.repaid)}, seized ${fmtAmount(
        result.seizedTokens
      )} ETH, and pocketed ${fmtUsd(result.liquidatorProfit)} profit.`,
    })
  }

  const handleReset = () => setSim(INITIAL_SIM)

  return (
    <div className="relative min-h-svh overflow-hidden pt-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-white opacity-[0.04] blur-[140px]" />
      </div>

      <div
        className="relative z-10 mx-auto max-w-5xl px-4 py-10"
        style={{ animation: "fade-in-up 0.5s ease-out" }}
      >
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Lending simulator</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Drag the ETH price and watch what happens to Bob's loan. Same math as the real
            contracts — no wallet, nothing on-chain. Just a sandbox to see how it all connects.
          </p>
        </div>

        <div
          className={cn(
            "mb-6 flex items-center justify-between rounded-xl border bg-card px-5 py-4",
            risk === "danger" ? "border-red-500/40" : "border-border/60"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="relative flex size-2.5">
              {risk !== "none" && (
                <span
                  className={cn(
                    "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                    meta.dot
                  )}
                />
              )}
              <span className={cn("relative inline-flex size-2.5 rounded-full", meta.dot)} />
            </span>
            <div>
              <div className={cn("text-sm font-bold", meta.tone)}>{meta.label}</div>
              <div className="text-[11px] text-muted-foreground">
                {risk === "danger"
                  ? "Bob's collateral no longer safely covers his loan."
                  : risk === "risky"
                    ? "Bob is close to the liquidation line — one more drop could trigger it."
                    : risk === "safe"
                      ? "Bob's collateral comfortably covers his loan."
                      : "Bob hasn't borrowed anything yet."}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Health factor
            </div>
            <div className={cn("text-2xl font-bold tabular-nums", hfColor(hf))}>
              {hf === Infinity ? "∞" : hf.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-5">
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CryptoIcon symbol="ETH" size={22} />
                  <span className="text-sm font-bold text-foreground">ETH price</span>
                </div>
                <span className="font-bold tabular-nums text-foreground">
                  {fmtUsd(sim.collateralPrice)}
                </span>
              </div>
              <Slider
                min={1_000}
                max={6_000}
                step={50}
                value={[sim.collateralPrice]}
                onValueChange={([v]) => set({ collateralPrice: v })}
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>$1,000</span>
                {liqPrice > 0 && (
                  <span className="flex items-center gap-1 text-red-500/80">
                    <TrendingDown className="size-3" />
                    liquidation at {fmtUsd(liqPrice)}
                  </span>
                )}
                <span>$6,000</span>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Bob's collateral</span>
                <span className="font-bold tabular-nums text-foreground">
                  {fmtAmount(sim.bobCollateral)} ETH
                </span>
              </div>
              <Slider
                min={0}
                max={20}
                step={0.5}
                value={[sim.bobCollateral]}
                onValueChange={([v]) => set({ bobCollateral: v })}
              />
              <div className="mt-2 text-[10px] text-muted-foreground">
                Worth {fmtUsd(cv)} at the current price
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Bob's borrow</span>
                <span className="font-bold tabular-nums text-foreground">
                  {fmtUsd(sim.bobDebt)}
                </span>
              </div>
              <Slider
                min={0}
                max={20_000}
                step={100}
                value={[sim.bobDebt]}
                onValueChange={([v]) => set({ bobDebt: v })}
              />
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>Max right now: {fmtUsd(sim.bobDebt + maxBorrow)}</span>
                <span>LTV {(ltv(sim) * 100).toFixed(0)}%</span>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Alice's supply</span>
                <span className="font-bold tabular-nums text-foreground">
                  {fmtUsd(sim.aliceSupply)}
                </span>
              </div>
              <Slider
                min={5_000}
                max={100_000}
                step={1_000}
                value={[sim.aliceSupply]}
                onValueChange={([v]) => set({ aliceSupply: Math.max(v, sim.bobDebt) })}
              />
              <div className="mt-2 text-[10px] text-muted-foreground">
                The USDC lenders have put in for borrowers to draw from
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleAccrue}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2.5 text-xs font-bold text-foreground transition-colors hover:border-foreground/30 hover:bg-white/[0.03]"
              >
                <Clock className="size-3.5" />
                Fast-forward 1 year
              </button>
              <button
                onClick={handleLiquidate}
                disabled={!canLiquidate}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all",
                  canLiquidate
                    ? "bg-red-500 text-white hover:bg-red-500/90"
                    : "cursor-not-allowed border border-border/60 text-muted-foreground opacity-50"
                )}
              >
                <Zap className="size-3.5" />
                Liquidate Bob
              </button>
              <button
                onClick={handleReset}
                className="ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Bob's position {sim.years > 0 && `· ${sim.years}y elapsed`}
              </h2>
              <div className="rounded-xl border border-border/60 bg-card p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Collateral value
                    </div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-foreground">
                      {fmtUsd(cv)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Debt owed
                    </div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-foreground">
                      {fmtUsd(sim.bobDebt)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-border/40 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Health factor
                    </span>
                    <span className={cn("text-sm font-bold tabular-nums", hfColor(hf))}>
                      {hf === Infinity ? "∞" : hf.toFixed(2)}
                    </span>
                  </div>
                  <HealthGauge hf={hf} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Liquidation price"
                value={liqPrice > 0 ? fmtUsd(liqPrice) : "—"}
                sub={liqPrice > 0 ? `now at ${fmtUsd(sim.collateralPrice)}` : "no loan"}
                valueClass={sim.collateralPrice <= liqPrice * 1.1 && liqPrice > 0 ? "text-warning" : ""}
              />
              <Stat
                label="Loan-to-value"
                value={`${(ltv(sim) * 100).toFixed(1)}%`}
                sub={`max ${(SIM_PARAMS.maxLtv * 100).toFixed(0)}%`}
              />
            </div>

            <div>
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                The pool
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="Utilization"
                  value={`${(utilization(sim) * 100).toFixed(0)}%`}
                  sub={`${fmtUsd(availableLiquidity(sim))} free to borrow`}
                />
                <Stat
                  label="Borrow APR"
                  value={`${(borrowRate(sim) * 100).toFixed(2)}%`}
                  sub={`supply ${(supplyRate(sim) * 100).toFixed(2)}%`}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CryptoIcon symbol="USDC" size={22} />
                  <span className="text-sm font-bold text-foreground">Alice can withdraw</span>
                </div>
                <span className="text-lg font-bold tabular-nums text-success">
                  {fmtUsd(sim.aliceSupply)}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Her original deposit plus every dollar of interest Bob has paid. Use “Fast-forward 1
                year” and watch it grow.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-border/60 bg-card p-5 text-xs leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">Try this:</span> push Bob's borrow up near his
          max, then drag the ETH price down. Watch the health factor cross the red line — then hit{" "}
          <span className="font-bold text-foreground">Liquidate Bob</span> and see he still keeps the
          USDC he borrowed.
        </div>
      </div>
    </div>
  )
}
