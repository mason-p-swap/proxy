import { useMemo, useState } from "react"
import { formatUnits } from "viem"
import { MARKET_ASSETS } from "@/lib/web3"
import { useMoneyMarket, pct, usdOf, hfDisplayOf, hfColorOf } from "@/hooks/use-money-market"
import { shortAddress, connectWallet } from "@/hooks/use-wallet"
import { DashShell } from "@/components/dash-shell"
import { MarketActionModal, type ModalTarget } from "@/components/market-action-modal"
import { CryptoIcon } from "@/components/crypto-icon"
import { Switch } from "@/components/ui/switch"
import { fmtAmount, fmtUsd, fmtPct } from "@/lib/format"
import type { Route } from "@/lib/types"
import { ArrowDownToLine, ArrowUpFromLine, Skull, Loader2, Droplets, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = { navigate: (to: Route) => void }

export function DashboardPage({ navigate }: Props) {
  const mm = useMoneyMarket()
  const [modal, setModal] = useState<ModalTarget>(null)

  const summary = useMemo(() => {
    let supplyUsd = 0, debtUsd = 0, supplyYield = 0, debtCost = 0
    for (const a of MARKET_ASSETS) {
      const r = mm.reserves[a.key]
      const u = mm.userReserves[a.key]
      if (!r || !u) continue
      const s = usdOf(u.supplyBalance, a.decimals, r.price)
      const d = usdOf(u.debtBalance, a.decimals, r.price)
      supplyUsd += s
      debtUsd += d
      supplyYield += s * Number(formatUnits(r.supplyApr, 18))
      debtCost += d * Number(formatUnits(r.borrowApr, 18))
    }
    const netWorth = supplyUsd - debtUsd
    const netApy = netWorth > 0 ? ((supplyYield - debtCost) / netWorth) * 100 : 0
    return { supplyUsd, debtUsd, netWorth, netApy, earnRate: supplyYield - debtCost }
  }, [mm.reserves, mm.userReserves])

  const supplies = MARKET_ASSETS.filter((a) => (mm.userReserves[a.key]?.supplyBalance ?? 0n) > 0n)
  const borrows = MARKET_ASSETS.filter((a) => (mm.userReserves[a.key]?.debtBalance ?? 0n) > 0n)
  const hasPositions = supplies.length > 0 || borrows.length > 0
  const maxPositionUsd = useMemo(() => {
    let max = 0
    for (const a of MARKET_ASSETS) {
      const r = mm.reserves[a.key]
      const u = mm.userReserves[a.key]
      if (!r || !u) continue
      max = Math.max(max, usdOf(u.supplyBalance, a.decimals, r.price), usdOf(u.debtBalance, a.decimals, r.price))
    }
    return max
  }, [mm.reserves, mm.userReserves])

  return (
    <DashShell active="dashboard" navigate={navigate}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mm.account ? shortAddress(mm.account) : "your position at a glance"} · sepolia
          </p>
        </div>
        {mm.connected && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ name: "supply" })}
              className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-xs font-bold text-background transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              <ArrowDownToLine className="size-3.5" />
              Supply
            </button>
            <button
              onClick={() => navigate({ name: "borrow" })}
              className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-xs font-bold text-foreground transition-colors hover:border-foreground/30"
            >
              <ArrowUpFromLine className="size-3.5" />
              Borrow
            </button>
          </div>
        )}
      </div>

      {!mm.connected && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-background/50">
            <Wallet className="size-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Connect your wallet</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Connect to view your positions, supply assets to earn yield, and borrow against your
            collateral. Markets are live on Sepolia — nothing to sign up for.
          </p>
          {mm.hasProvider ? (
            <button
              onClick={connectWallet}
              disabled={mm.connecting}
              className="mt-6 flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background transition-all hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-60"
            >
              {mm.connecting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
              {mm.connecting ? "check MetaMask…" : "Connect Wallet"}
            </button>
          ) : (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background transition-all hover:bg-foreground/90"
            >
              <Wallet className="size-4" /> Install MetaMask
            </a>
          )}
        </div>
      )}

      {mm.connected && (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_1.4fr]">
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">balance</div>
              <div className="mt-1 text-3xl font-bold tabular-nums text-foreground">{fmtUsd(summary.netWorth)}</div>
              <div className="mt-4 space-y-2 border-t border-border/60 pt-4 text-xs">
                <SumRow label="position apy" value={fmtPct(summary.netApy)} />
                <SumRow
                  label="earning rate"
                  value={`${summary.earnRate >= 0 ? "+" : "−"}${fmtUsd(Math.abs(summary.earnRate))} / yr`}
                  className={summary.earnRate >= 0 ? "text-success" : "text-warning"}
                />
                <SumRow label="supplied" value={fmtUsd(summary.supplyUsd)} />
                <SumRow label="borrowed" value={fmtUsd(summary.debtUsd)} />
                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="text-muted-foreground">health factor</span>
                  <span className={cn("font-bold tabular-nums", hfColorOf(mm.hf))}>{hfDisplayOf(mm.hf)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">position shape</span>
                <span className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-success/70" /> supply</span>
                  <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-warning/70" /> debt</span>
                </span>
              </div>
              {!hasPositions ? (
                <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                  nothing here yet — your supplied assets and debts will draw themselves.
                </div>
              ) : (
                <div className="space-y-3">
                  {MARKET_ASSETS.map((a) => {
                    const r = mm.reserves[a.key]
                    const u = mm.userReserves[a.key]
                    if (!r || !u || (u.supplyBalance === 0n && u.debtBalance === 0n)) return null
                    const sUsd = usdOf(u.supplyBalance, a.decimals, r.price)
                    const dUsd = usdOf(u.debtBalance, a.decimals, r.price)
                    return (
                      <div key={a.key} className="flex items-center gap-3">
                        <CryptoIcon symbol={a.icon} size={20} />
                        <span className="w-10 text-[11px] font-bold">{a.symbol}</span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          {sUsd > 0 && (
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 rounded-sm bg-success/70"
                                style={{ width: `${Math.max(2, (sUsd / maxPositionUsd) * 100)}%` }}
                              />
                              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{fmtUsd(sUsd)}</span>
                            </div>
                          )}
                          {dUsd > 0 && (
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 rounded-sm bg-warning/70"
                                style={{ width: `${Math.max(2, (dUsd / maxPositionUsd) * 100)}%` }}
                              />
                              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{fmtUsd(dUsd)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {mm.accountData && mm.accountData.powerUsd > 0n && (
            <div className="mb-6 rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>borrow power used</span>
                <span className="tabular-nums">
                  {fmtUsd(Number(formatUnits(mm.accountData.debtUsd, 18)))} / {fmtUsd(Number(formatUnits(mm.accountData.powerUsd, 18)))}
                </span>
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
          )}

          {mm.liquidatable && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
              <Skull className="mt-0.5 size-5 shrink-0 text-destructive" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-bold text-destructive">health factor below 1.0 — this position is liquidatable.</span>{" "}
                anyone can repay up to half your debt and seize your collateral plus a bonus.
                repay debt or supply more collateral to recover.
              </p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="mb-3 text-lg font-bold tracking-tight text-foreground">Positions</h2>

            {!hasPositions && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
                <p className="text-xs text-muted-foreground">
                  no positions yet — supply an asset to start earning.
                </p>
                <button
                  onClick={() => navigate({ name: "supply" })}
                  className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-xs font-bold text-background transition-all hover:bg-foreground/90"
                >
                  <ArrowDownToLine className="size-3.5" />
                  supply your first asset
                </button>
              </div>
            )}

            {hasPositions && (
              <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
                <div className="divide-y divide-border/40">
                  {supplies.map((a) => {
                    const r = mm.reserves[a.key]
                    const u = mm.userReserves[a.key]
                    if (!r || !u) return null
                    return (
                      <PositionRow
                        key={`s-${a.key}`}
                        icon={a.icon}
                        kind="supply"
                        amount={`${fmtAmount(Number(formatUnits(u.supplyBalance, a.decimals)))} ${a.symbol}`}
                        usd={fmtUsd(usdOf(u.supplyBalance, a.decimals, r.price))}
                        apy={pct(r.supplyApr)}
                        apyClass="text-emerald-500"
                      >
                        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          collateral
                          <Switch
                            checked={u.usingAsCollateral}
                            disabled={mm.busy !== null}
                            onCheckedChange={(v) => mm.toggleCollateral(a.key, v)}
                          />
                        </label>
                        <PillBtn onClick={() => setModal({ asset: a.key, action: "withdraw" })}>withdraw</PillBtn>
                        <PillBtn primary onClick={() => setModal({ asset: a.key, action: "supply" })}>add</PillBtn>
                      </PositionRow>
                    )
                  })}
                  {borrows.map((a) => {
                    const r = mm.reserves[a.key]
                    const u = mm.userReserves[a.key]
                    if (!r || !u) return null
                    return (
                      <PositionRow
                        key={`b-${a.key}`}
                        icon={a.icon}
                        kind="debt"
                        amount={`${fmtAmount(Number(formatUnits(u.debtBalance, a.decimals)))} ${a.symbol}`}
                        usd={fmtUsd(usdOf(u.debtBalance, a.decimals, r.price))}
                        apy={pct(r.borrowApr)}
                        apyClass="text-warning"
                      >
                        <PillBtn primary onClick={() => setModal({ asset: a.key, action: "repay" })}>repay</PillBtn>
                        <PillBtn onClick={() => setModal({ asset: a.key, action: "borrow" })}>borrow more</PillBtn>
                      </PositionRow>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/30 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">test faucets</span>
            {MARKET_ASSETS.map((a) => (
              <button
                key={a.key}
                onClick={() => mm.mint(a.key)}
                disabled={mm.busy !== null}
                className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
              >
                {mm.busy === `mint-${a.key}` ? <Loader2 className="size-3 animate-spin" /> : <Droplets className="size-3" />}
                {a.symbol}
              </button>
            ))}
          </div>

        </>
      )}

      <MarketActionModal target={modal} onClose={() => setModal(null)} mm={mm} />
    </DashShell>
  )
}

function SumRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums text-foreground", className)}>{value}</span>
    </div>
  )
}

function PositionRow({ icon, kind, amount, usd, apy, apyClass, children }: {
  icon: string
  kind: "supply" | "debt"
  amount: string
  usd: string
  apy: string
  apyClass?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
      <CryptoIcon symbol={icon} size={28} />
      <div className="flex min-w-[110px] flex-col">
        <span className="text-xs font-bold tabular-nums text-foreground">{amount}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">{usd}</span>
      </div>
      <span className={cn(
        "rounded-sm border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        kind === "supply" ? "border-success/40 text-success" : "border-warning/40 text-warning"
      )}>
        {kind}
      </span>
      <span className={cn("text-[11px] font-semibold tabular-nums", apyClass)}>{apy}</span>
      <div className="ml-auto flex items-center gap-2.5">{children}</div>
    </div>
  )
}

function PillBtn({ children, onClick, primary, disabled }: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "bg-foreground text-background hover:bg-foreground/90"
          : "border border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
