import { useEffect, useMemo, useState } from "react"
import { formatUnits } from "viem"
import { ADDR_AMM, ROUTER_ABI, SWAP_TOKENS, publicClient } from "@/lib/web3"
import { fmtAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

const LEVELS = 8
const STEP = 0.0012

type Level = { price: number; size: number; cum: number }

type Props = { refreshKey?: number; onPickPrice?: (price: number) => void }

export function OrderBook({ refreshKey, onPickPrice }: Props) {
  const base = SWAP_TOKENS.find((t) => t.symbol === "zXMR")!
  const quote = SWAP_TOKENS.find((t) => t.symbol === "USDC")!
  const [reserves, setReserves] = useState<{ rz: number; rq: number } | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      publicClient
        .readContract({ address: ADDR_AMM.router, abi: ROUTER_ABI, functionName: "getReserves", args: [base.address!, quote.address!] })
        .then((r) => {
          if (!alive) return
          const [a, b] = r as readonly [bigint, bigint]
          setReserves({ rz: Number(formatUnits(a, base.decimals)), rq: Number(formatUnits(b, quote.decimals)) })
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 12000)
    return () => { alive = false; clearInterval(t) }
  }, [base.address, quote.address, base.decimals, quote.decimals, refreshKey])

  const book = useMemo(() => {
    if (!reserves || reserves.rz <= 0 || reserves.rq <= 0) return null
    const { rz, rq } = reserves
    const k = rz * rq
    const mid = rq / rz

    const asks: Level[] = []
    let prevA = 0
    for (let i = 1; i <= LEVELS; i++) {
      const price = mid * (1 + i * STEP)
      const cum = rz - Math.sqrt(k / price)
      asks.push({ price, size: cum - prevA, cum })
      prevA = cum
    }
    const bids: Level[] = []
    let prevB = 0
    for (let i = 1; i <= LEVELS; i++) {
      const price = mid * (1 - i * STEP)
      const cum = Math.sqrt(k / price) - rz
      bids.push({ price, size: cum - prevB, cum })
      prevB = cum
    }
    const maxCum = Math.max(asks[asks.length - 1].cum, bids[bids.length - 1].cum) || 1
    return { mid, asks: asks.reverse(), bids, maxCum }
  }, [reserves])

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">Order book</span>
        <span className="text-[10px] text-muted-foreground">pool depth · zXMR / USDC</span>
      </div>

      <div className="grid grid-cols-3 px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Price (USD)</span>
        <span className="text-right">Size (zXMR)</span>
        <span className="text-right">Total</span>
      </div>

      {!book ? (
        <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">loading depth…</div>
      ) : (
        <div className="space-y-px">
          {book.asks.map((l, i) => (
            <Row key={`a${i}`} level={l} maxCum={book.maxCum} kind="ask" onClick={() => onPickPrice?.(l.price)} />
          ))}
          <div className="flex items-center justify-between px-1 py-1.5">
            <span className="text-sm font-bold tabular-nums text-foreground">${fmtAmount(book.mid)}</span>
            <span className="text-[10px] text-muted-foreground">mid</span>
          </div>
          {book.bids.map((l, i) => (
            <Row key={`b${i}`} level={l} maxCum={book.maxCum} kind="bid" onClick={() => onPickPrice?.(l.price)} />
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ level, maxCum, kind, onClick }: { level: Level; maxCum: number; kind: "ask" | "bid"; onClick: () => void }) {
  const pct = Math.min(100, (level.cum / maxCum) * 100)
  const ask = kind === "ask"
  return (
    <button onClick={onClick} className="relative grid w-full grid-cols-3 overflow-hidden rounded-sm px-1 py-1 text-left transition-colors hover:bg-white/[0.03]">
      <span
        className={cn("absolute inset-y-0 right-0", ask ? "bg-destructive/10" : "bg-success/10")}
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      <span className={cn("relative z-10 text-xs font-semibold tabular-nums", ask ? "text-destructive" : "text-success")}>
        {fmtAmount(level.price)}
      </span>
      <span className="relative z-10 text-right text-xs tabular-nums text-foreground">{fmtAmount(level.size)}</span>
      <span className="relative z-10 text-right text-[11px] tabular-nums text-muted-foreground">{fmtAmount(level.cum)}</span>
    </button>
  )
}
