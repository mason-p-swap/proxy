import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CryptoIcon } from "@/components/crypto-icon"
import { fmtAmount, fmtUsd } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  DEFI_MARKET_MAP,
  PORTFOLIO,
  collateralPowerUsd,
  borrowedUsd,
  healthFactor,
  positionUsd,
  isStable,
  type DefiMarket,
} from "@/lib/defi-data"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  market: DefiMarket | null
  onClose: () => void
}

function healthColor(hf: number) {
  if (hf >= 2) return "text-emerald-500"
  if (hf >= 1.2) return "text-warning"
  return "text-red-500"
}

export function BorrowModal({ market, onClose }: Props) {
  const [amount, setAmount] = useState("")

  const parsed = useMemo(() => {
    const n = parseFloat(amount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [amount])

  const collateralPower = collateralPowerUsd()
  const currentDebt = borrowedUsd()

  const borrowUsd = parsed * (market?.price ?? 0)
  const newDebt = currentDebt + borrowUsd
  const ltv = collateralPower > 0 ? newDebt / (collateralPower / 0.8) : 0
  const hf = healthFactor(collateralPower, newDebt)

  const maxBorrowUsd = Math.max(0, collateralPower / 1.1 - currentDebt)
  const maxBorrowTokens = market ? maxBorrowUsd / market.price : 0
  const overMax = borrowUsd > maxBorrowUsd

  const primary = PORTFOLIO.supplied
    .filter((p) => !isStable(p.symbol) && DEFI_MARKET_MAP[p.symbol])
    .sort((a, b) => positionUsd(b) - positionUsd(a))[0]
  const primaryMarket = primary ? DEFI_MARKET_MAP[primary.symbol] : undefined
  const primaryAmount = primary?.amount ?? 0
  const otherPower = primaryMarket
    ? collateralPower - primaryAmount * primaryMarket.price * primaryMarket.liquidationThreshold
    : collateralPower
  const liqPrice =
    primaryMarket && primaryAmount > 0
      ? Math.max(0, (newDebt - otherPower) / (primaryAmount * primaryMarket.liquidationThreshold))
      : 0

  const handleBorrow = () => {
    if (!market || parsed <= 0 || overMax) return
    toast.success(`Borrowed ${fmtAmount(parsed)} ${market.symbol}`, {
      description: `Health factor now ${hf === Infinity ? "∞" : hf.toFixed(2)}. (Demo — no real transaction.)`,
    })
    setAmount("")
    onClose()
  }

  return (
    <Dialog open={market !== null} onOpenChange={(v) => { if (!v) { setAmount(""); onClose() } }}>
      <DialogContent className="max-w-sm rounded-xl border-border bg-popover p-0">
        {market && (
          <>
            <DialogHeader className="border-b border-border/60 px-5 pb-4 pt-5">
              <DialogTitle className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                <CryptoIcon symbol={market.symbol} size={22} />
                Borrow {market.symbol}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Borrow against your supplied collateral at {market.borrowApy.toFixed(2)}% APY.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-5 pb-5">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-xs">
                <span className="text-muted-foreground">Your collateral</span>
                <div className="flex items-center gap-2">
                  {PORTFOLIO.supplied.map((p) => (
                    <span key={p.symbol} className="flex items-center gap-1 font-bold tabular-nums text-foreground">
                      <CryptoIcon symbol={p.symbol} size={14} />
                      {fmtAmount(p.amount)}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Borrow amount
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    Max: {fmtAmount(maxBorrowTokens)} {market.symbol}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5 focus-within:border-foreground/30">
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
                  />
                  <button
                    onClick={() => setAmount(maxBorrowTokens.toFixed(2))}
                    className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-foreground transition-colors hover:bg-white/20"
                  >
                    MAX
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="tabular-nums">≈ {fmtUsd(borrowUsd)}</span>
                  {overMax && <span className="text-red-500">Exceeds safe borrow limit</span>}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 bg-card p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Borrow APY</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {market.borrowApy.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Loan to value</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {(ltv * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Health factor</span>
                  <span className={cn("font-bold tabular-nums", healthColor(hf))}>
                    {hf === Infinity ? "∞" : hf.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {primary?.symbol ?? "Collateral"} liquidation price
                  </span>
                  <span className="font-bold tabular-nums text-foreground">
                    {liqPrice > 0 ? fmtUsd(liqPrice) : "—"}
                  </span>
                </div>
              </div>

              <button
                onClick={handleBorrow}
                disabled={parsed <= 0 || overMax}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Borrow {market.symbol}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
