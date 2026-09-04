import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CryptoIcon } from "@/components/crypto-icon"
import { fmtAmount, fmtUsd } from "@/lib/format"
import type { DefiMarket } from "@/lib/defi-data"
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

export function SupplyModal({ market, onClose }: Props) {
  const [amount, setAmount] = useState("")

  const parsed = useMemo(() => {
    const n = parseFloat(amount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [amount])

  const usdValue = parsed * (market?.price ?? 0)
  const annualEarnings = (usdValue * (market?.supplyApy ?? 0)) / 100
  const overBalance = market !== null && parsed > market.walletBalance

  const handleSupply = () => {
    if (!market || parsed <= 0 || overBalance) return
    toast.success(`Supplied ${fmtAmount(parsed)} ${market.symbol}`, {
      description: `Now earning ${market.supplyApy.toFixed(2)}% APY. (Demo — no real transaction.)`,
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
                Supply {market.symbol}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Deposit {market.name} and start earning yield immediately.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-5 pb-5">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Amount
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    Balance: {fmtAmount(market.walletBalance)} {market.symbol}
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
                    onClick={() => setAmount(String(market.walletBalance))}
                    className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-foreground transition-colors hover:bg-white/20"
                  >
                    MAX
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="tabular-nums">≈ {fmtUsd(usdValue)}</span>
                  {overBalance && <span className="text-red-500">Exceeds wallet balance</span>}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 bg-card p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Supply APY</span>
                  <span className="font-bold tabular-nums text-emerald-500">
                    {market.supplyApy.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Est. annual earnings</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {fmtUsd(annualEarnings)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Collateral factor</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {(market.collateralFactor * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <button
                onClick={handleSupply}
                disabled={parsed <= 0 || overBalance}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Supply {market.symbol}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
