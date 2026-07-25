import { useState } from "react"
import { CryptoIcon } from "@/components/crypto-icon"
import { hasApiKey, getStoredOrder, fetchOrderUpdate } from "@/lib/changenow"
import { usePrices } from "@/lib/prices"
import { fmtAmount, fmtUsd, fmtDate } from "@/lib/format"
import type { Route, Exchange } from "@/lib/types"
import { Search, ArrowRight, ChevronLeft, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  navigate: (to: Route) => void
}

export function OrderLookupPage({ navigate }: Props) {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<Exchange | null>(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const priceOf = usePrices()

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = query.trim()
    if (!id) return
    setLoading(true)
    setSearched(false)
    let order = getStoredOrder(id)
    if (!order && hasApiKey) {
      try {
        order = await fetchOrderUpdate(id)
      } catch {
        order = null
      }
    }
    setResult(order)
    setSearched(true)
    setLoading(false)
  }

  const fromPrice = result ? priceOf(result.fromSymbol) : 0
  const toPrice = result ? priceOf(result.toSymbol) : 0

  return (
    <div className="relative z-10 mx-auto max-w-xl px-4 py-6">
      <button
        onClick={() => navigate({ name: "home" })}
        className="mb-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        back
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold">find your order</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          enter your order id to track the status of your swap.
        </p>
      </div>

      <form onSubmit={search} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="your order id"
              className="h-11 w-full rounded-sm border border-input bg-muted pl-9 pr-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-sm bg-foreground px-4 text-sm font-bold uppercase tracking-wider text-background hover:bg-foreground/90 disabled:opacity-60"
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            find
          </button>
        </div>
        {!hasApiKey && (
          <p className="mt-2 px-1 text-[10px] text-muted-foreground">
            without a ChangeNOW API key, only orders created on this device can be found.
          </p>
        )}
      </form>

      {searched && result && (
        <button
          onClick={() => navigate({ name: "exchange", id: result.id })}
          className="block w-full rounded-md border border-border bg-card p-4 text-left transition-colors hover:bg-accent/30"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">order</span>
            <span className="font-bold">#{result.id}</span>
          </div>

          <div className="flex items-center gap-3">
            <CryptoIcon symbol={result.fromSymbol} size={28} />
            <div className="flex flex-col">
              <span className="text-sm font-bold tabular-nums">{fmtAmount(result.fromAmount)} {result.fromSymbol}</span>
              {fromPrice > 0 && (
                <span className="text-[10px] text-muted-foreground">≈ {fmtUsd(result.fromAmount * fromPrice)}</span>
              )}
            </div>
            <ArrowRight className="mx-auto size-4 text-muted-foreground" />
            <CryptoIcon symbol={result.toSymbol} size={28} />
            <div className="flex flex-col">
              <span className="text-sm font-bold tabular-nums">{fmtAmount(result.toAmount)} {result.toSymbol}</span>
              {toPrice > 0 && (
                <span className="text-[10px] text-muted-foreground">≈ {fmtUsd(result.toAmount * toPrice)}</span>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="text-muted-foreground">{fmtDate(result.createdAt)}</span>
            <span className={cn(
              "flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-wider",
              result.status === "done" ? "border-success/50 text-success" :
              result.status === "failed" || result.status === "expired" ? "border-destructive/50 text-destructive" :
              "border-border text-foreground"
            )}>
              {result.status === "done" && <Check className="size-3" />}
              {result.status}
            </span>
          </div>
        </button>
      )}

      {searched && !result && (
        <div className="rounded-md border border-border bg-card p-8 text-center">
          <div className="text-sm text-muted-foreground">no order found</div>
          <div className="mt-1 text-[10px] text-muted-foreground">check your order id and try again</div>
        </div>
      )}
    </div>
  )
}
