import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { SwapToken } from "@/lib/web3"
import {
  createBridgeOrder,
  getBridgeOrder,
  BRIDGE_STATUS_LABEL,
  BRIDGE_FEE_PCT,
  BRIDGE_IS_LIVE,
  type BridgeOrder,
  type BridgeStatus,
} from "@/lib/bridge"
import { CryptoIcon } from "@/components/crypto-icon"
import { fmtAmount } from "@/lib/format"
import { Loader2, ArrowRight, Copy, Check, CircleCheck, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS: BridgeStatus[] = ["awaiting_deposit", "confirming", "exchanging", "sending", "completed"]

type Props = {
  from: SwapToken
  to: SwapToken
  fromAmount: string
  account?: string
}

export function XmrBridgeFlow({ from, to, fromAmount, account }: Props) {
  const xmrOut = Boolean(to.isBridge)
  const [payout, setPayout] = useState(xmrOut ? "" : account ?? "")
  const [order, setOrder] = useState<BridgeOrder | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!xmrOut && account && !payout) setPayout(account)
  }, [account, xmrOut, payout])

  useEffect(() => {
    if (!order || order.status === "completed" || order.status === "expired") return
    const t = setInterval(async () => {
      const next = await getBridgeOrder(order.id)
      if (next) setOrder(next)
    }, 2000)
    return () => clearInterval(t)
  }, [order])

  const amt = parseFloat(fromAmount) || 0
  const canCreate = amt > 0 && payout.trim().length > 8 && !creating

  const create = async () => {
    setCreating(true)
    try {
      const o = await createBridgeOrder({
        fromSymbol: from.symbol,
        toSymbol: to.symbol,
        fromAmount,
        payoutAddress: payout.trim(),
      })
      setOrder(o)
    } catch {
      toast.error("could not create bridge order")
    } finally {
      setCreating(false)
    }
  }

  if (order) return <OrderCard order={order} onReset={() => setOrder(null)} />

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" />
        Native Monero swaps settle through our cross-chain bridge — the on-chain leg is
        decentralized, the Monero payout is handled by the bridge.{" "}
        {!BRIDGE_IS_LIVE && <span className="text-warning">Demo bridge: no real funds move.</span>}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">
          {xmrOut ? "Your Monero (XMR) address" : "Your Ethereum address"}
        </label>
        <input
          value={payout}
          onChange={(e) => setPayout(e.target.value)}
          placeholder={xmrOut ? "4… or 8… Monero address" : "0x… address"}
          spellCheck={false}
          className="w-full rounded-lg border border-input bg-background/50 px-3 py-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <button
        onClick={create}
        disabled={!canCreate}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition-all",
          canCreate
            ? "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
            : "cursor-not-allowed bg-muted text-muted-foreground"
        )}
      >
        {creating ? <Loader2 className="size-4 animate-spin" /> : null}
        {creating ? "creating…" : "Create swap"}
        {canCreate && <ArrowRight className="size-4" />}
      </button>
    </div>
  )
}

function OrderCard({ order, onReset }: { order: BridgeOrder; onReset: () => void }) {
  const done = order.status === "completed"
  const activeIdx = STEPS.indexOf(order.status)
  const fromAmt = fmtAmount(Number(order.fromAmount))
  const toAmt = fmtAmount(Number(order.toAmount))

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background/40">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          {done ? (
            <CircleCheck className="size-4 text-success" />
          ) : (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          <span className="text-sm font-bold text-foreground">{BRIDGE_STATUS_LABEL[order.status]}</span>
        </div>
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground">{order.id}</span>
      </div>

      <div className="flex items-center gap-1 px-4 pt-3">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < activeIdx ? "bg-success" : i === activeIdx ? (done ? "bg-success" : "bg-success/50") : "bg-white/10"
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <CryptoIcon symbol={order.fromSymbol} size={20} />
          <div className="flex flex-col">
            <span className="text-sm font-bold tabular-nums text-foreground">{fromAmt}</span>
            <span className="text-[10px] text-muted-foreground">{order.fromSymbol}</span>
          </div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold tabular-nums text-foreground">{toAmt}</span>
            <span className="text-[10px] text-muted-foreground">{order.toSymbol}</span>
          </div>
          <CryptoIcon symbol={order.toSymbol} size={20} />
        </div>
      </div>

      {!done && (
        <div className="border-t border-border/60 bg-card/40 px-4 py-3">
          <div className="text-[11px] text-muted-foreground">
            Send exactly <span className="font-bold text-foreground">{fromAmt} {order.depositAsset}</span> to
          </div>
          <div className="mt-1.5">
            <CopyRow value={order.depositAddress} />
          </div>
        </div>
      )}

      <div className="border-t border-border/60 px-4 py-3 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>{done ? "Sent to" : "Payout to"}</span>
          <span className="opacity-70">Fee {BRIDGE_FEE_PCT}%</span>
        </div>
        <div className="mt-1 break-all font-mono text-[10px] text-foreground/80">{order.payoutAddress}</div>
      </div>

      <div className="border-t border-border/60 p-3">
        <button
          onClick={onReset}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          New swap
        </button>
      </div>
    </div>
  )
}

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <button
      onClick={copy}
      className="flex w-full items-center gap-2 rounded-md border border-input bg-card/60 px-2.5 py-2 text-left transition-colors hover:border-foreground/30"
    >
      <span className="min-w-0 flex-1 break-all font-mono text-[10px] text-foreground/90">{value}</span>
      {copied ? <Check className="size-3.5 shrink-0 text-success" /> : <Copy className="size-3.5 shrink-0 text-muted-foreground" />}
    </button>
  )
}
