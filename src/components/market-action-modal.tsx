import { useState } from "react"
import { formatUnits, parseUnits } from "viem"
import { MARKET_ASSETS, type MarketAssetKey } from "@/lib/web3"
import { ACTION_META, type ActionKey, type MoneyMarket } from "@/hooks/use-money-market"
import { CryptoIcon } from "@/components/crypto-icon"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fmtAmount } from "@/lib/format"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type ModalTarget = { asset: MarketAssetKey; action: ActionKey } | null

type Props = {
  target: ModalTarget
  onClose: () => void
  mm: MoneyMarket
}

export function MarketActionModal({ target, onClose, mm }: Props) {
  const [amount, setAmount] = useState("")

  const [usedMax, setUsedMax] = useState(false)

  const meta = target ? MARKET_ASSETS.find((a) => a.key === target.asset)! : null
  const def = target ? ACTION_META[target.action] : null
  const max = target ? mm.maxFor(target.asset, target.action) : 0n

  const close = () => {
    setAmount("")
    setUsedMax(false)
    onClose()
  }

  const amt = (() => {
    try {
      return target && meta ? parseUnits((amount || "0") as `${number}`, meta.decimals) : 0n
    } catch {
      return null
    }
  })()
  const overMax = amt !== null && amt > max

  const submit = async () => {
    if (!target) return

    const u = mm.userReserves[target.asset]
    const sentinelSafe =
      target.action === "withdraw" ||
      (target.action === "repay" && !!u && u.walletBalance > u.debtBalance)
    const ok = await mm.act(target.asset, target.action, amount, usedMax && sentinelSafe)
    if (ok) close()
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent className="max-w-sm">
        {target && meta && def && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <CryptoIcon symbol={meta.icon} size={22} />
                {def.title} {meta.symbol}
              </DialogTitle>
            </DialogHeader>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{def.help}.</p>
            <div className="flex rounded-lg border border-input bg-background">
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setUsedMax(false) }}
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-semibold tabular-nums focus-visible:outline-none"
              />
              <button
                onClick={() => { setAmount(formatUnits(max, meta.decimals)); setUsedMax(true) }}
                className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                max
              </button>
              <span className="flex items-center border-l border-input px-3 text-xs font-bold">{meta.symbol}</span>
            </div>
            <div className={cn("px-1 text-[10px]", overMax ? "font-semibold text-destructive" : "text-muted-foreground")}>
              {overMax
                ? `that's more than available — max ${fmtAmount(Number(formatUnits(max, meta.decimals)))} ${meta.symbol}`
                : `available: ${fmtAmount(Number(formatUnits(max, meta.decimals)))} ${meta.symbol}`}
            </div>
            <button
              onClick={submit}
              disabled={mm.busy !== null || !amount || parseFloat(amount) <= 0 || overMax}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold uppercase tracking-wider transition-all",
                mm.busy === null && amount && parseFloat(amount) > 0 && !overMax
                  ? "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
                  : "cursor-not-allowed bg-muted text-muted-foreground"
              )}
            >
              {mm.busy === "act" && <Loader2 className="size-4 animate-spin" />}
              {mm.busy === "act" ? "check MetaMask…" : `${def.title} ${meta.symbol}`}
            </button>
            {def.approves && (
              <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
                may show two MetaMask popups: an approval, then the {def.title.toLowerCase()} itself.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
