import { useEffect, useMemo, useState } from "react"
import { formatUnits, parseUnits } from "viem"
import { toast } from "sonner"
import type { Route } from "@/lib/types"
import {
  ADDR_AMM,
  TRADE_MARKETS,
  TRADE_QUOTE,
  ROUTER_ABI,
  ERC20_ABI,
  EXPLORER,
  publicClient,
  walletClient,
} from "@/lib/web3"
import {
  createLimitOrder,
  cancelOrder,
  syncFills,
  listOrders,
  type LimitOrder,
} from "@/lib/orders"
import { useWallet, connectWallet, switchToSepolia } from "@/hooks/use-wallet"
import { PriceChart } from "@/components/price-chart"
import { OrderBook } from "@/components/order-book"
import { CryptoIcon } from "@/components/crypto-icon"
import { fmtAmount, fmtUsd, timeAgo } from "@/lib/format"
import { Loader2, Wallet, AlertTriangle, Droplets, X } from "lucide-react"
import { cn } from "@/lib/utils"

const SLIPPAGE_BPS = 50n

const EXPIRY_OPTS: { label: string; ms: number | null }[] = [
  { label: "1H", ms: 60 * 60 * 1000 },
  { label: "1D", ms: 24 * 60 * 60 * 1000 },
  { label: "1W", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "Never", ms: null },
]

function untilStr(ts: number): string {
  const ms = ts - Date.now()
  if (ms <= 0) return "expired"
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function TradePage({ navigate: _navigate }: { navigate: (to: Route) => void }) {
  const { hasProvider, account, connecting, onSepolia } = useWallet()
  const connected = hasProvider && Boolean(account) && onSepolia

  const [marketSym, setMarketSym] = useState(TRADE_MARKETS[0].symbol)
  const base = TRADE_MARKETS.find((m) => m.symbol === marketSym)!
  const quote = TRADE_QUOTE
  const [poolPrice, setPoolPrice] = useState<number | null>(null)
  const mkt = poolPrice ?? 0

  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [type, setType] = useState<"market" | "limit">("market")
  const [amount, setAmount] = useState("")
  const [limitPrice, setLimitPrice] = useState("")
  const [priceEdited, setPriceEdited] = useState(false)
  const [expiryMs, setExpiryMs] = useState<number | null>(24 * 60 * 60 * 1000)
  const [busy, setBusy] = useState<string | null>(null)
  const [quoteOut, setQuoteOut] = useState<bigint | null>(null)
  const [orders, setOrders] = useState<LimitOrder[]>([])
  const [balBase, setBalBase] = useState<bigint | null>(null)
  const [balQuote, setBalQuote] = useState<bigint | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setPoolPrice(null)
    setPriceEdited(false)
    setAmount("")
    setQuoteOut(null)
  }, [marketSym])

  useEffect(() => {
    if (!priceEdited && mkt > 0) setLimitPrice(mkt.toFixed(mkt < 10 ? 4 : 2))
  }, [mkt, priceEdited])

  useEffect(() => {
    let alive = true
    publicClient
      .readContract({
        address: ADDR_AMM.router, abi: ROUTER_ABI, functionName: "getAmountsOut",
        args: [parseUnits("1", base.decimals), [base.address, quote.address]],
      })
      .then((r) => {
        const amounts = r as bigint[]
        if (alive && amounts.length) setPoolPrice(Number(formatUnits(amounts[amounts.length - 1], quote.decimals)))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [base.address, base.decimals, quote.address, quote.decimals, refreshKey])

  useEffect(() => {
    setOrders(syncFills(base.symbol, mkt || 0))
    const t = setInterval(() => setOrders(syncFills(base.symbol, mkt || 0)), 15000)
    return () => clearInterval(t)
  }, [base.symbol, mkt])

  useEffect(() => {
    if (!account) { setBalBase(null); setBalQuote(null); return }
    let alive = true
    Promise.all([
      publicClient.readContract({ address: base.address, abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
      publicClient.readContract({ address: quote.address, abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
    ]).then(([b, q]) => { if (alive) { setBalBase(b as bigint); setBalQuote(q as bigint) } }).catch(() => {})
    return () => { alive = false }
  }, [account, base.address, quote.address, refreshKey])

  const fromTok = side === "buy" ? quote : base
  const toTok = side === "buy" ? base : quote
  const path = side === "buy" ? [quote.address, base.address] : [base.address, quote.address]
  const amt = parseFloat(amount) || 0

  useEffect(() => {
    if (type !== "market" || amt <= 0) { setQuoteOut(null); return }
    let alive = true
    const t = setTimeout(async () => {
      try {
        const r = await publicClient.readContract({
          address: ADDR_AMM.router, abi: ROUTER_ABI, functionName: "getAmountsOut",
          args: [parseUnits(amount as `${number}`, fromTok.decimals), path],
        })
        const amounts = r as bigint[]
        if (alive) setQuoteOut(amounts.length ? amounts[amounts.length - 1] : null)
      } catch { if (alive) setQuoteOut(null) }
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [amount, side, type, amt, marketSym])

  const estOut = quoteOut != null ? Number(formatUnits(quoteOut, toTok.decimals)) : null
  const fromBal = side === "buy" ? balQuote : balBase
  const overBalance = fromBal != null && amt > 0 && parseUnits((amount || "0") as `${number}`, fromTok.decimals) > fromBal

  const sendTx = async (label: string, fn: () => Promise<`0x${string}`>) => {
    const hash = await fn()
    toast.loading(`${label} — waiting for Sepolia…`, { id: hash })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== "success") { toast.error(`${label} reverted`, { id: hash }); throw new Error("reverted") }
    toast.success(
      <span>{label} confirmed · <a className="underline" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">explorer</a></span>,
      { id: hash }
    )
  }

  const friendlyError = (e: any): string | null => {
    const msg = String(e?.shortMessage ?? e?.message ?? e)
    if (/denied|rejected/i.test(msg)) return null
    return msg.split("\n")[0].slice(0, 140)
  }

  const execMarket = async () => {
    if (!account || amt <= 0) return
    setBusy("market")
    try {
      const inWei = parseUnits(amount as `${number}`, fromTok.decimals)
      const r = await publicClient.readContract({
        address: ADDR_AMM.router, abi: ROUTER_ABI, functionName: "getAmountsOut", args: [inWei, path],
      })
      const amounts = r as bigint[]
      if (!amounts.length) { toast.error("no route / not enough liquidity"); return }
      const outWei = amounts[amounts.length - 1]
      const minOut = (outWei * (10_000n - SLIPPAGE_BPS)) / 10_000n
      const wc = walletClient(account)
      const allowance = (await publicClient.readContract({
        address: fromTok.address, abi: ERC20_ABI, functionName: "allowance", args: [account, ADDR_AMM.router],
      })) as bigint
      if (allowance < inWei) {
        await sendTx(`Approving ${fromTok.symbol}`, () =>
          wc.writeContract({ address: fromTok.address, abi: ERC20_ABI, functionName: "approve", args: [ADDR_AMM.router, inWei] })
        )
      }
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
      await sendTx(`${side === "buy" ? "Buy" : "Sell"} ${base.symbol}`, () =>
        wc.writeContract({
          address: ADDR_AMM.router, abi: ROUTER_ABI, functionName: "swapExactTokensForTokens",
          args: [inWei, minOut, path, account, deadline],
        })
      )
      setAmount("")
      setRefreshKey((k) => k + 1)
    } catch (e) {
      const m = friendlyError(e)
      if (m) toast.error(m)
    } finally {
      setBusy(null)
    }
  }

  const placeLimit = () => {
    const lp = parseFloat(limitPrice) || 0
    if (amt <= 0 || lp <= 0) return
    const expiresAt = expiryMs ? Date.now() + expiryMs : undefined
    createLimitOrder({ side, base: base.symbol, quote: quote.symbol, amount: amt, limitPrice: lp, expiresAt })
    setOrders(syncFills(base.symbol, mkt || 0))
    setAmount("")
    toast.success(`Limit ${side} order placed`)
  }

  const faucet = async (which: "base" | "quote") => {
    if (!account) return
    const tok = which === "base" ? base : quote
    setBusy(`faucet-${which}`)
    try {
      const wc = walletClient(account)
      await sendTx(`Minting test ${tok.symbol}`, () =>
        wc.writeContract({ address: tok.address, abi: ERC20_ABI, functionName: "faucet" })
      )
      setRefreshKey((k) => k + 1)
    } catch (e) {
      const m = friendlyError(e)
      if (m) toast.error(m)
    } finally {
      setBusy(null)
    }
  }

  const limitCost = useMemo(() => {
    const lp = parseFloat(limitPrice) || 0
    return amt > 0 && lp > 0 ? amt * lp : 0
  }, [amt, limitPrice])

  const amountLabel =
    type === "market"
      ? side === "buy" ? "Amount to spend (USDC)" : `Amount to sell (${base.symbol})`
      : `Amount (${base.symbol})`

  const marketOrders = orders.filter((o) => o.base === base.symbol)
  const openOrders = marketOrders.filter((o) => o.status === "open")
  const pastOrders = marketOrders.filter((o) => o.status !== "open")

  return (
    <div className="relative min-h-svh overflow-hidden pt-14">
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8" style={{ animation: "fade-in-up 0.5s ease-out" }}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Trade</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Buy and sell at market, or set a limit order. Market orders settle on-chain in one swap.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {TRADE_MARKETS.map((m) => (
              <button
                key={m.symbol}
                onClick={() => setMarketSym(m.symbol)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  marketSym === m.symbol ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CryptoIcon symbol={m.icon} size={16} />
                {m.symbol} / USDC
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <PriceChart anchor={mkt} coingecko={base.coingecko} symbol={base.symbol} />
            <OrderBook
              base={base}
              refreshKey={refreshKey}
              onPickPrice={(p) => { setLimitPrice(p.toFixed(p < 10 ? 4 : 2)); setPriceEdited(true); setType("limit") }}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-background p-1">
              <button
                onClick={() => setSide("buy")}
                className={cn("rounded-md py-2 text-sm font-bold transition-colors", side === "buy" ? "bg-success text-success-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Buy
              </button>
              <button
                onClick={() => setSide("sell")}
                className={cn("rounded-md py-2 text-sm font-bold transition-colors", side === "sell" ? "bg-destructive text-white" : "text-muted-foreground hover:text-foreground")}
              >
                Sell
              </button>
            </div>

            <div className="mt-3 flex gap-3 text-xs">
              {(["market", "limit"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn("border-b-2 pb-1 font-bold capitalize transition-colors", type === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  {t}
                </button>
              ))}
              <span className="ml-auto self-end text-[11px] text-muted-foreground">
                mkt {mkt > 0 ? fmtUsd(mkt) : "—"}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">{amountLabel}</label>
                <div className="flex items-center rounded-lg border border-input bg-background px-3 py-2.5">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    className="min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums focus-visible:outline-none"
                  />
                  <CryptoIcon symbol={type === "market" && side === "buy" ? "USDC" : base.icon} size={18} />
                </div>
                {fromBal != null && (
                  <div className="flex justify-end px-1 text-[10px] text-muted-foreground">
                    balance {fmtAmount(Number(formatUnits(fromBal, fromTok.decimals)))} {fromTok.symbol}
                    <button
                      onClick={() => setAmount(formatUnits(fromBal, fromTok.decimals))}
                      className="ml-1.5 font-bold uppercase text-foreground/70 hover:text-foreground"
                    >
                      max
                    </button>
                  </div>
                )}
              </div>

              {type === "limit" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground">Limit price (USD)</label>
                  <div className="flex items-center rounded-lg border border-input bg-background px-3 py-2.5">
                    <span className="mr-1 text-sm text-muted-foreground">$</span>
                    <input
                      value={limitPrice}
                      onChange={(e) => { setLimitPrice(e.target.value); setPriceEdited(true) }}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums focus-visible:outline-none"
                    />
                  </div>
                </div>
              )}

              {type === "limit" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground">Expiry</label>
                  <div className="flex gap-1">
                    {EXPIRY_OPTS.map((o) => (
                      <button
                        key={o.label}
                        onClick={() => setExpiryMs(o.ms)}
                        className={cn(
                          "flex-1 rounded-md border py-1.5 text-[11px] font-bold transition-colors",
                          expiryMs === o.ms ? "border-transparent bg-white/10 text-foreground" : "border-input text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="min-h-4 px-1 text-[11px] text-muted-foreground">
                {type === "market" && estOut != null && (
                  <span>
                    You receive ≈ <span className="font-semibold text-foreground">{fmtAmount(estOut)} {toTok.symbol}</span>
                    <span className="ml-2 opacity-70">· 0.3% fee/hop</span>
                  </span>
                )}
                {type === "limit" && limitCost > 0 && (
                  <span>
                    {side === "buy" ? "Cost" : "Receive"} ≈ <span className="font-semibold text-foreground">{fmtAmount(limitCost)} USDC</span> when {base.symbol} {side === "buy" ? "≤" : "≥"} ${fmtAmount(parseFloat(limitPrice))}
                  </span>
                )}
              </div>

              {!hasProvider && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-[11px] text-muted-foreground">
                  <Wallet className="size-3.5" /> install MetaMask to trade on-chain.
                </div>
              )}
              {hasProvider && !account && (
                <button onClick={connectWallet} disabled={connecting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-3 text-sm font-bold uppercase tracking-wider text-background transition-all hover:bg-foreground/90 disabled:opacity-60">
                  {connecting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                  {connecting ? "check MetaMask…" : "Connect Wallet"}
                </button>
              )}
              {hasProvider && account && !onSepolia && (
                <button onClick={switchToSepolia} className="flex w-full items-center justify-center gap-2 rounded-lg bg-warning py-3 text-sm font-bold uppercase tracking-wider text-warning-foreground">
                  <AlertTriangle className="size-4" /> Switch to Sepolia
                </button>
              )}

              {connected && type === "market" && (
                <button
                  onClick={execMarket}
                  disabled={amt <= 0 || overBalance || busy !== null || estOut == null}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition-all",
                    amt > 0 && !overBalance && estOut != null && busy === null
                      ? side === "buy" ? "bg-success text-success-foreground hover:opacity-90" : "bg-destructive text-white hover:opacity-90"
                      : "cursor-not-allowed bg-muted text-muted-foreground"
                  )}
                >
                  {busy === "market" && <Loader2 className="size-4 animate-spin" />}
                  {busy === "market" ? "check MetaMask…" : overBalance ? `insufficient ${fromTok.symbol}` : `${side === "buy" ? "Buy" : "Sell"} ${base.symbol}`}
                </button>
              )}

              {connected && type === "limit" && (
                <button
                  onClick={placeLimit}
                  disabled={amt <= 0 || (parseFloat(limitPrice) || 0) <= 0}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition-all",
                    amt > 0 && (parseFloat(limitPrice) || 0) > 0
                      ? side === "buy" ? "bg-success text-success-foreground hover:opacity-90" : "bg-destructive text-white hover:opacity-90"
                      : "cursor-not-allowed bg-muted text-muted-foreground"
                  )}
                >
                  Place limit {side}
                </button>
              )}

              {connected && (
                <div className="flex justify-center gap-4 pt-1 text-[11px] text-muted-foreground">
                  <button onClick={() => faucet("quote")} disabled={busy !== null} className="flex items-center gap-1 hover:text-foreground disabled:opacity-50">
                    {busy === "faucet-quote" ? <Loader2 className="size-3 animate-spin" /> : <Droplets className="size-3" />} test USDC
                  </button>
                  <button onClick={() => faucet("base")} disabled={busy !== null} className="flex items-center gap-1 hover:text-foreground disabled:opacity-50">
                    {busy === "faucet-base" ? <Loader2 className="size-3 animate-spin" /> : <Droplets className="size-3" />} test {base.symbol}
                  </button>
                </div>
              )}

              {type === "limit" && (
                <p className="rounded-lg border border-border/60 bg-background p-2.5 text-[10px] leading-relaxed text-muted-foreground">
                  Limit orders are tracked here and fill when the market crosses your price. In this preview the fill is
                  simulated; a keeper executes them for real once the backend is live.
                </p>
              )}

              <div className="rounded-lg border border-border/60 bg-background p-2.5 text-[10px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Taker fee</span>
                  <span className="font-semibold text-foreground">0.30%</span>
                </div>
                <div className="mt-0.5 flex justify-between">
                  <span>Maker fee</span>
                  <span className="font-semibold text-foreground">0.00%</span>
                </div>
                <p className="mt-1.5 leading-relaxed opacity-80">
                  Trades settle against the liquidity pool. The fee accrues to suppliers — it's the staking yield they earn.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {base.symbol} orders
          </div>
          {marketOrders.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
              no orders yet — your limit orders will show here.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {[...openOrders, ...pastOrders].map((o) => (
                <div key={o.id} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-3 px-4 py-3 text-xs">
                  <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase", o.side === "buy" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                    {o.side}
                  </span>
                  <span className="tabular-nums text-foreground">
                    {fmtAmount(o.amount)} {o.base} <span className="text-muted-foreground">@ ${fmtAmount(o.limitPrice)}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    <span className={cn("font-bold uppercase", o.status === "filled" ? "text-success" : o.status === "open" ? "text-warning" : "text-muted-foreground")}>
                      {o.status}
                    </span>
                    {" · "}
                    {o.status === "open" && o.expiresAt ? `exp ${untilStr(o.expiresAt)}` : timeAgo(o.filledAt ?? o.createdAt)}
                  </span>
                  {o.status === "open" ? (
                    <button
                      onClick={() => { cancelOrder(o.id); setOrders(listOrders()) }}
                      className="flex items-center gap-1 justify-self-end text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" /> cancel
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
