import { useEffect, useRef, useState } from "react"
import { CoinSelector } from "@/components/coin-selector"
import { COIN_MAP } from "@/lib/mock-data"
import {
  hasApiKey,
  fetchMinAmount,
  fetchEstimate,
  validateAddress,
  createExchange,
  type Quote,
} from "@/lib/changenow"
import { usePrices } from "@/lib/prices"
import { fmtUsd, fmtAmount } from "@/lib/format"
import type { Route } from "@/lib/types"
import { ArrowDown, ArrowRight, AlertCircle, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  navigate: (to: Route) => void
}

type AddrState = "idle" | "checking" | "valid" | "invalid"

export function SwapWidget({ navigate }: Props) {
  const [fromSymbol, setFromSymbol] = useState("SOL")
  const [toSymbol, setToSymbol] = useState("BTC")
  const [fromAmount, setFromAmount] = useState("2.5")
  const [destAddress, setDestAddress] = useState("")
  const [extraId, setExtraId] = useState("")

  const [minAmount, setMinAmount] = useState<number | null>(null)
  const [quote, setQuote] = useState<(Quote & { forAmount: number }) | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const [addrState, setAddrState] = useState<AddrState>("idle")
  const [addrMessage, setAddrMessage] = useState<string | null>(null)
  const [needsExtraId, setNeedsExtraId] = useState(false)

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const priceOf = usePrices()
  const to = COIN_MAP[toSymbol]
  const amt = parseFloat(fromAmount) || 0

  const quoteSeq = useRef(0)

  useEffect(() => {
    const seq = ++quoteSeq.current
    setQuote(null)
    setQuoteError(null)
    setCreateError(null)
    if (amt <= 0) {
      setQuoting(false)
      return
    }
    setQuoting(true)
    const t = setTimeout(async () => {
      try {
        const min = await fetchMinAmount(fromSymbol, toSymbol)
        if (seq !== quoteSeq.current) return
        setMinAmount(min)
        if (amt < min) {
          setQuoteError(`minimum is ${fmtAmount(min)} ${fromSymbol}`)
          setQuoting(false)
          return
        }
        const q = await fetchEstimate(fromSymbol, toSymbol, amt)
        if (seq !== quoteSeq.current) return
        setQuote({ ...q, forAmount: amt })
        setQuoting(false)
      } catch (e) {
        if (seq !== quoteSeq.current) return
        setQuoteError(e instanceof Error ? e.message : "couldn't fetch a rate")
        setQuoting(false)
      }
    }, 450)
    return () => clearTimeout(t)
  }, [fromSymbol, toSymbol, amt])

  useEffect(() => {
    setCreateError(null)
    if (destAddress.trim().length < 8) {
      setAddrState("idle")
      setAddrMessage(null)
      setNeedsExtraId(false)
      return
    }
    setAddrState("checking")
    const addr = destAddress.trim()
    const t = setTimeout(async () => {
      const check = await validateAddress(toSymbol, addr)
      setAddrState(check.ok ? "valid" : "invalid")
      setAddrMessage(check.ok ? null : check.message)
      setNeedsExtraId(check.needsExtraId)
    }, 500)
    return () => clearTimeout(t)
  }, [destAddress, toSymbol])

  const fromUsd = amt * priceOf(fromSymbol)
  const toUsd = (quote?.toAmount ?? 0) * priceOf(toSymbol)
  const rate = quote && quote.forAmount > 0 ? quote.toAmount / quote.forAmount : null

  const pickFrom = (s: string) => {
    if (s === toSymbol) setToSymbol(fromSymbol)
    setFromSymbol(s)
  }
  const pickTo = (s: string) => {
    if (s === fromSymbol) setFromSymbol(toSymbol)
    setToSymbol(s)
  }

  const swap = () => {
    setFromSymbol(toSymbol)
    setToSymbol(fromSymbol)
    if (quote) setFromAmount(fmtAmount(quote.toAmount).replace(/,/g, ""))
    setDestAddress("")
    setExtraId("")
  }

  const canExchange =
    hasApiKey &&
    !!quote &&
    !quoting &&
    !quoteError &&
    destAddress.trim().length > 0 &&
    addrState !== "invalid" &&
    addrState !== "checking" &&
    !creating

  const handleExchange = async () => {
    if (!canExchange) return
    setCreating(true)
    setCreateError(null)
    try {
      const order = await createExchange({
        fromSymbol,
        toSymbol,
        fromAmount: amt,
        destinationAddress: destAddress.trim(),
        extraId: extraId.trim() || undefined,
      })
      navigate({ name: "exchange", id: order.id })
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "could not create the swap")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card/60 p-5 backdrop-blur-md">

      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Send</label>
        <div className="flex rounded-lg border border-input bg-background/50">
          <input
            type="text"
            inputMode="decimal"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-semibold tabular-nums focus-visible:outline-none"
          />
          <CoinSelector
            value={fromSymbol}
            onChange={pickFrom}
            className="w-[110px] shrink-0 border-l border-input"
            borderless
          />
        </div>
        <div className="flex justify-between px-1 text-[11px] text-muted-foreground">
          <span>≈ {fmtUsd(fromUsd)}</span>
          <span>{minAmount != null ? `min ${fmtAmount(minAmount)} ${fromSymbol}` : " "}</span>
        </div>
      </div>

      <div className="relative flex justify-center -my-2">
        <button
          onClick={swap}
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:rotate-180 hover:text-foreground hover:border-foreground/30"
          style={{ transitionDuration: "300ms" }}
        >
          <ArrowDown className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Receive</label>
        <div className={cn(
          "flex rounded-lg border bg-background/50",
          quoteError ? "border-destructive/50" : "border-input"
        )}>
          <div className="flex min-w-0 flex-1 items-center px-3 py-3">
            {quoting ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : quote ? (
              <span className="truncate text-base font-semibold tabular-nums">≈ {fmtAmount(quote.toAmount)}</span>
            ) : (
              <span className="text-base font-semibold text-muted-foreground">0</span>
            )}
          </div>
          <CoinSelector
            value={toSymbol}
            onChange={pickTo}
            exclude={fromSymbol}
            className="w-[110px] shrink-0 border-l border-input"
            borderless
          />
        </div>
        <div className="flex justify-between px-1 text-[11px] text-muted-foreground">
          <span>≈ {fmtUsd(toUsd)}</span>
          <span>
            {quoteError
              ? <span className="text-destructive">{quoteError}</span>
              : rate
                ? `1 ${fromSymbol} = ${fmtAmount(rate)} ${toSymbol}`
                : "live rate via ChangeNOW"}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <label className="text-[11px] text-muted-foreground">
          Destination address
        </label>
        <div className={cn(
          "flex items-center rounded-lg border bg-background/50",
          addrState === "invalid" ? "border-destructive/50" : "border-input"
        )}>
          <input
            type="text"
            value={destAddress}
            onChange={(e) => setDestAddress(e.target.value)}
            placeholder={`${to.name} (${to.network}) address`}
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-mono focus-visible:outline-none"
          />
          <span className="pr-3">
            {addrState === "checking" && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            {addrState === "valid" && <Check className="size-3.5 text-success" />}
            {addrState === "invalid" && <AlertCircle className="size-3.5 text-destructive" />}
          </span>
        </div>
        {addrState === "invalid" && addrMessage && (
          <p className="px-1 text-[11px] text-destructive">{addrMessage.toLowerCase()}</p>
        )}
      </div>

      {(needsExtraId || ["XRP", "ATOM"].includes(toSymbol)) && (
        <div className="mt-3 space-y-1.5">
          <label className="text-[11px] text-muted-foreground">
            Memo / destination tag{needsExtraId ? "" : " (optional)"}
          </label>
          <input
            type="text"
            value={extraId}
            onChange={(e) => setExtraId(e.target.value)}
            placeholder={toSymbol === "XRP" ? "destination tag" : "memo"}
            className="h-11 w-full rounded-lg border border-input bg-background/50 px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-1.5">
        <span className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground">
          Float rate
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {quote?.speedForecast ? `ETA ${quote.speedForecast} min · ` : ""}all fees included
        </span>
      </div>

      {quote?.warning && (
        <p className="mt-2 flex items-start gap-1.5 px-1 text-[11px] text-warning">
          <AlertCircle className="mt-px size-3 shrink-0" />
          {quote.warning}
        </p>
      )}

      <button
        onClick={handleExchange}
        disabled={!canExchange}
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition-all",
          canExchange
            ? "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
            : "cursor-not-allowed bg-muted text-muted-foreground"
        )}
      >
        {creating ? <Loader2 className="size-4 animate-spin" /> : null}
        {creating ? "creating swap..." : "Exchange now"}
        {!creating && <ArrowRight className="size-4" />}
      </button>

      {createError && (
        <p className="mt-2 flex items-start gap-1.5 px-1 text-[11px] text-destructive">
          <AlertCircle className="mt-px size-3 shrink-0" />
          {createError}
        </p>
      )}

      {!hasApiKey && (
        <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Rates shown are live. To enable real swaps, add a free ChangeNOW API key:
          copy <span className="font-mono">.env.example</span> to <span className="font-mono">.env</span>,
          paste your key, and restart the dev server.
        </p>
      )}
    </div>
  )
}
