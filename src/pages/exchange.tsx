import { useState, useEffect } from "react"
import QRCode from "react-qr-code"
import { CryptoIcon } from "@/components/crypto-icon"
import { COIN_MAP } from "@/lib/mock-data"
import { hasApiKey, getStoredOrder, fetchOrderUpdate } from "@/lib/swap-api"
import { usePrices } from "@/lib/prices"
import { fmtAmount, fmtUsd, fmtDate } from "@/lib/format"
import type { Route, Exchange, ExchangeStatus } from "@/lib/types"
import {
  Copy,
  Clock,
  ArrowRight,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  route: { name: "exchange"; id: string }
  navigate: (to: Route) => void
}

const STEPS: { key: ExchangeStatus; label: string }[] = [
  { key: "awaiting", label: "deposit" },
  { key: "confirming", label: "confirming" },
  { key: "exchanging", label: "exchanging" },
  { key: "sending", label: "sending" },
  { key: "done", label: "done" },
]

const TERMINAL: ExchangeStatus[] = ["done", "failed", "expired"]

const STATUS_COPY: Partial<Record<ExchangeStatus, { title: string; sub: (fx: Exchange) => string }>> = {
  confirming: {
    title: "deposit detected",
    sub: (fx) => `waiting for network confirmations on your ${fx.fromSymbol} deposit`,
  },
  exchanging: {
    title: "exchanging",
    sub: (fx) => `swapping ${fx.fromSymbol} for ${fx.toSymbol} at the best available rate`,
  },
  sending: {
    title: "sending",
    sub: (fx) => `${fx.toSymbol} is on its way to your wallet`,
  },
}

export function ExchangePage({ route, navigate }: Props) {
  const [exchange, setExchange] = useState<Exchange | null>(() => getStoredOrder(route.id))
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)
  const priceOf = usePrices()

  useEffect(() => {
    if (exchange || !hasApiKey) {
      if (!exchange && !hasApiKey) setNotFound(true)
      return
    }
    let alive = true
    fetchOrderUpdate(route.id)
      .then((o) => alive && (o ? setExchange(o) : setNotFound(true)))
      .catch(() => alive && setNotFound(true))
    return () => { alive = false }

  }, [route.id])

  useEffect(() => {
    if (!exchange || !hasApiKey || TERMINAL.includes(exchange.status)) return
    const timer = setInterval(() => {
      fetchOrderUpdate(exchange.id).then((o) => o && setExchange(o)).catch(() => {})
    }, 15_000)
    return () => clearInterval(timer)
  }, [exchange?.id, exchange?.status])

  useEffect(() => {
    if (!exchange || exchange.expiresAt <= 0) return
    setRemaining(Math.max(0, exchange.expiresAt - Date.now()))
    const timer = setInterval(() => {
      setRemaining(Math.max(0, exchange.expiresAt - Date.now()))
    }, 1000)
    return () => clearInterval(timer)
  }, [exchange?.expiresAt])

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  if (notFound || !exchange) {
    return (
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-10">
        <BackLink navigate={navigate} />
        <div className="rounded-xl border border-border bg-card/60 p-10 text-center backdrop-blur-md">
          {notFound ? (
            <>
              <div className="text-sm text-muted-foreground">order not found</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {hasApiKey
                  ? "check the order id and try again"
                  : "orders created on this device appear here — remote lookup needs the swap API key"}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> loading order...
            </div>
          )}
        </div>
      </div>
    )
  }

  const from = COIN_MAP[exchange.fromSymbol]
  const fromPrice = priceOf(exchange.fromSymbol)
  const toPrice = priceOf(exchange.toSymbol)
  const isFailed = exchange.status === "failed" || exchange.status === "expired"
  const currentStepIndex = STEPS.findIndex((s) => s.key === exchange.status)
  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)

  return (
    <div className="relative z-10 mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <BackLink navigate={navigate} />
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => copy("id", exchange.id)}
            className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="copy order id"
          >
            <span className="text-[10px] uppercase tracking-wider">order</span>
            <span className="font-mono font-bold text-foreground">#{exchange.id}</span>
            {copied === "id" ? <Check className="size-3 text-success" /> : <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />}
          </button>
          <span className={cn(
            "rounded-sm border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
            exchange.status === "done" ? "border-success/50 text-success" :
            isFailed ? "border-destructive/50 text-destructive" :
            "border-border bg-card/60 text-foreground"
          )}>
            {exchange.status}
          </span>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card/60 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const done = i < currentStepIndex || exchange.status === "done"
            const active = i === currentStepIndex && exchange.status !== "done"
            return (
              <div key={step.key} className={cn("flex items-center", i > 0 && "flex-1")}>
                {i > 0 && (
                  <div className={cn(
                    "mx-2 h-px flex-1 sm:mx-3",
                    done ? "bg-success/60" : "bg-border"
                  )} />
                )}
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums transition-colors",
                    done && "border-success bg-success text-success-foreground",
                    active && !isFailed && "border-foreground text-foreground",
                    active && isFailed && "border-destructive text-destructive",
                    !done && !active && "border-border text-muted-foreground"
                  )}>
                    {done ? <Check className="size-3" /> : active && isFailed ? <AlertCircle className="size-3" /> : i + 1}
                  </div>
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider",
                    active ? "font-bold text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60",
                    !active && "hidden sm:block"
                  )}>
                    {step.label}
                  </span>
                  {active && !isFailed && (
                    <span className="size-1.5 animate-pulse rounded-full bg-foreground" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">

        <div>
          {exchange.status === "awaiting" && (
            <div className="overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  send your deposit
                </span>
                {exchange.expiresAt > 0 && (
                  <span className="flex items-center gap-1.5 text-warning">
                    <Clock className="size-3.5" />
                    <span className="text-xs font-bold tabular-nums">
                      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                    </span>
                  </span>
                )}
              </div>

              <div className="p-5">
                <div className="mb-5 flex items-center gap-3">
                  <CryptoIcon symbol={exchange.fromSymbol} size={40} />
                  <div>
                    <div className="text-2xl font-bold tabular-nums leading-tight">
                      {fmtAmount(exchange.fromAmount)} <span className="text-base font-semibold text-muted-foreground">{exchange.fromSymbol}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      send exactly this amount · {from?.network ?? exchange.fromSymbol} network
                      {fromPrice > 0 && <> · ≈ {fmtUsd(exchange.fromAmount * fromPrice)}</>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <div className="rounded-lg bg-white p-2.5">
                      <QRCode value={exchange.depositAddress} size={132} bgColor="#ffffff" fgColor="#000000" />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">scan to deposit</span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">deposit address</span>
                      <button
                        onClick={() => copy("deposit", exchange.depositAddress)}
                        className="group flex w-full items-center gap-2 rounded-lg border border-input bg-background/50 px-3 py-3 text-left transition-colors hover:border-foreground/30"
                      >
                        <span className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed">
                          {exchange.depositAddress}
                        </span>
                        {copied === "deposit"
                          ? <Check className="size-4 shrink-0 text-success" />
                          : <Copy className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />}
                      </button>
                    </div>

                    {exchange.payinExtraId && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-warning">memo / tag — required</span>
                        <button
                          onClick={() => copy("extraId", exchange.payinExtraId!)}
                          className="flex w-full items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-3 text-left"
                        >
                          <span className="min-w-0 flex-1 break-all font-mono text-xs">{exchange.payinExtraId}</span>
                          {copied === "extraId"
                            ? <Check className="size-4 shrink-0 text-success" />
                            : <Copy className="size-4 shrink-0 text-muted-foreground" />}
                        </button>
                      </div>
                    )}

                    <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                      <span>
                        send the exact amount in one transaction{exchange.payinExtraId ? ", including the memo/tag" : ""}.
                        don&apos;t send from an exchange that doesn&apos;t support {from?.network ?? "this network"}.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isFailed && exchange.status !== "awaiting" && exchange.status !== "done" && (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card/60 p-8 text-center backdrop-blur-md">
              <div className="relative flex size-16 items-center justify-center">
                <Loader2 className="absolute inset-0 size-16 animate-spin text-border" strokeWidth={1} />
                <CryptoIcon symbol={exchange.toSymbol} size={32} />
              </div>
              <div>
                <div className="text-lg font-bold">{STATUS_COPY[exchange.status]?.title ?? exchange.status}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {STATUS_COPY[exchange.status]?.sub(exchange)}
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                updates automatically — no need to refresh
              </div>
            </div>
          )}

          {exchange.status === "done" && (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-success/40 bg-card/60 p-8 text-center backdrop-blur-md">
              <div className="flex size-14 items-center justify-center rounded-full border border-success bg-success/10">
                <Check className="size-7 text-success" />
              </div>
              <div>
                <div className="text-lg font-bold">swap complete</div>
                <div className="mt-2 text-2xl font-bold tabular-nums">
                  {fmtAmount(exchange.toAmount)} <span className="text-base text-muted-foreground">{exchange.toSymbol}</span>
                </div>
                {toPrice > 0 && (
                  <div className="mt-0.5 text-xs text-muted-foreground">≈ {fmtUsd(exchange.toAmount * toPrice)} sent to your wallet</div>
                )}
              </div>
              {exchange.txIdTo && (
                <a
                  href={`https://blockchair.com/search?q=${encodeURIComponent(exchange.txIdTo)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-foreground/30"
                >
                  view payout transaction <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )}

          {isFailed && (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-destructive/40 bg-card/60 p-8 text-center backdrop-blur-md">
              <div className="flex size-14 items-center justify-center rounded-full border border-destructive bg-destructive/10">
                <AlertCircle className="size-7 text-destructive" />
              </div>
              <div>
                <div className="text-lg font-bold">
                  {exchange.status === "expired" ? "order expired" : "swap failed"}
                </div>
                <div className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  {exchange.status === "expired"
                    ? "no deposit arrived in time. nothing was sent, nothing was lost — just start a new swap."
                    : "something went wrong with this order. if you already deposited, contact support with your order id — funds are recoverable."}
                </div>
              </div>
              <button
                onClick={() => navigate({ name: "home" })}
                className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background transition-all hover:bg-foreground/90 active:scale-[0.98]"
              >
                start a new swap <ArrowRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">swap</div>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <CryptoIcon symbol={exchange.fromSymbol} size={26} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold tabular-nums">{fmtAmount(exchange.fromAmount)} {exchange.fromSymbol}</div>
                  {fromPrice > 0 && <div className="text-[10px] text-muted-foreground">≈ {fmtUsd(exchange.fromAmount * fromPrice)}</div>}
                </div>
              </div>
              <div className="ml-3 h-3 w-px bg-border" />
              <div className="flex items-center gap-2.5">
                <CryptoIcon symbol={exchange.toSymbol} size={26} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold tabular-nums">
                    {exchange.status === "done" ? "" : "≈ "}{fmtAmount(exchange.toAmount)} {exchange.toSymbol}
                  </div>
                  {toPrice > 0 && <div className="text-[10px] text-muted-foreground">≈ {fmtUsd(exchange.toAmount * toPrice)}</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">your receiving address</div>
            <button
              onClick={() => copy("dest", exchange.destinationAddress)}
              className="group flex w-full items-center gap-2 text-left"
            >
              <span className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-foreground">
                {exchange.destinationAddress}
              </span>
              {copied === "dest"
                ? <Check className="size-3.5 shrink-0 text-success" />
                : <Copy className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">details</div>
            <div className="space-y-2 text-xs">
              <Row label="rate" value={`1 ${exchange.fromSymbol} = ${fmtAmount(exchange.rate)} ${exchange.toSymbol}`} />
              <Row label="rate type" value={exchange.rateType} />
              <Row label="created" value={fmtDate(exchange.createdAt)} />
              {exchange.txIdFrom && <TxRow label="deposit tx" hash={exchange.txIdFrom} />}
              {exchange.txIdTo && <TxRow label="payout tx" hash={exchange.txIdTo} />}
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/30 p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              save your order id <span className="font-mono text-foreground">#{exchange.id}</span> —
              it&apos;s the only key to this swap. no account, no email, no trace.
            </p>
          </div>

          {!hasApiKey && !TERMINAL.includes(exchange.status) && (
            <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
              live status updates need the swap API key — this view won&apos;t refresh on its own.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function BackLink({ navigate }: { navigate: (to: Route) => void }) {
  return (
    <button
      onClick={() => navigate({ name: "home" })}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4" />
      new swap
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function TxRow({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <a
        className="flex items-center gap-1 truncate text-foreground hover:underline"
        href={`https://blockchair.com/search?q=${encodeURIComponent(hash)}`}
        target="_blank"
        rel="noreferrer"
      >
        {hash.slice(0, 14)}...
        <ExternalLink className="size-3 shrink-0" />
      </a>
    </div>
  )
}
