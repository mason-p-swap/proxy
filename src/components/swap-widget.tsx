import { useEffect, useState } from "react"
import { formatUnits, parseUnits } from "viem"
import { toast } from "sonner"
import {
  SWAP_TOKENS,
  ROUTER_ABI,
  ERC20_ABI,
  EXPLORER,
  publicClient,
  walletClient,
  type SwapToken,
} from "@/lib/web3"
import { quoteBestRoute, venueLabel, type RoutePlan } from "@/lib/route-engine"
import { useWallet, connectWallet, switchToSepolia } from "@/hooks/use-wallet"
import { CryptoIcon } from "@/components/crypto-icon"
import { fmtAmount } from "@/lib/format"
import { ArrowDown, ArrowRight, Loader2, Wallet, AlertTriangle, Droplets, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const SLIPPAGE_BPS = 50n
const GAS_BUFFER = 5_000_000_000_000_000n

export function SwapWidget() {
  const { hasProvider, account, connecting, onSepolia } = useWallet()
  const [fromSym, setFromSym] = useState("ETH")
  const [toSym, setToSym] = useState("zXMR")
  const [amountIn, setAmountIn] = useState("1")
  const [quoteOut, setQuoteOut] = useState<bigint | null>(null)
  const [plan, setPlan] = useState<RoutePlan | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteErr, setQuoteErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [fromBal, setFromBal] = useState<bigint | null>(null)
  const [picker, setPicker] = useState<"from" | "to" | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const from = SWAP_TOKENS.find((t) => t.symbol === fromSym)!
  const to = SWAP_TOKENS.find((t) => t.symbol === toSym)!
  const xmrInvolved = Boolean(from.comingSoon || to.comingSoon)
  const amt = parseFloat(amountIn) || 0

  const connected = hasProvider && Boolean(account) && onSepolia

  useEffect(() => {
    if (!account) {
      setFromBal(null)
      return
    }
    let alive = true
    const read = from.isNative
      ? publicClient.getBalance({ address: account })
      : from.address
        ? publicClient.readContract({ address: from.address, abi: ERC20_ABI, functionName: "balanceOf", args: [account] })
        : Promise.resolve(null)
    read.then((b) => alive && setFromBal(b)).catch(() => {})
    return () => { alive = false }
  }, [account, from.address, from.isNative, refreshKey])

  useEffect(() => {
    setQuoteErr(null)
    if (xmrInvolved || amt <= 0) {
      setQuoteOut(null)
      setPlan(null)
      setQuoting(false)
      return
    }
    setQuoting(true)
    const t = setTimeout(async () => {
      try {
        const quote = await quoteBestRoute(from, to, parseUnits(amountIn as `${number}`, from.decimals))
        if (!quote) {
          setQuoteErr("no route / not enough liquidity")
          setQuoteOut(null)
          setPlan(null)
        } else {
          setQuoteOut(quote.amounts[quote.amounts.length - 1])
          setPlan(quote.plan)
        }
        setQuoting(false)
      } catch {
        setQuoteErr("no route / not enough liquidity")
        setQuoteOut(null)
        setPlan(null)
        setQuoting(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [amountIn, from, to, xmrInvolved, refreshKey])

  const pick = (side: "from" | "to", sym: string) => {
    if (side === "from") {
      if (sym === toSym) setToSym(fromSym)
      setFromSym(sym)
    } else {
      if (sym === fromSym) setFromSym(toSym)
      setToSym(sym)
    }
    setPicker(null)
  }

  const flip = () => {
    setFromSym(toSym)
    setToSym(fromSym)
    setAmountIn(quoteOut ? formatUnits(quoteOut, to.decimals) : amountIn)
  }

  const rate = quoteOut && amt > 0 ? Number(formatUnits(quoteOut, to.decimals)) / amt : null
  const minOut = quoteOut ? (quoteOut * (10_000n - SLIPPAGE_BPS)) / 10_000n : 0n
  const overBalance = fromBal != null && amt > 0 && parseUnits((amountIn || "0") as `${number}`, from.decimals) > fromBal

  const sendTx = async (label: string, fn: () => Promise<`0x${string}`>) => {
    const hash = await fn()
    toast.loading(`${label} — waiting for Sepolia…`, { id: hash })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== "success") {
      toast.error(`${label} reverted`, { id: hash })
      throw new Error("reverted")
    }
    toast.success(
      <span>
        {label} confirmed ·{" "}
        <a className="underline" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">explorer</a>
      </span>,
      { id: hash }
    )
  }

  const friendlyError = (e: any): string | null => {
    const msg = String(e?.shortMessage ?? e?.message ?? e)
    if (/denied|rejected/i.test(msg)) return null
    return msg.split("\n")[0].slice(0, 140)
  }

  const faucet = async () => {
    if (!account || !from.address) return
    setBusy("faucet")
    try {
      const wc = walletClient(account)
      await sendTx(`Minting test ${from.symbol}`, () =>
        wc.writeContract({ address: from.address!, abi: ERC20_ABI, functionName: "faucet" })
      )
      setRefreshKey((k) => k + 1)
    } catch (e) {
      const m = friendlyError(e)
      if (m) toast.error(m)
    } finally {
      setBusy(null)
    }
  }

  const doSwap = async () => {
    if (!account || !plan || !quoteOut) return
    setBusy("swap")
    try {
      const wc = walletClient(account)
      const inWei = parseUnits(amountIn as `${number}`, from.decimals)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

      if (!from.isNative) {
        const allowance = (await publicClient.readContract({
          address: from.address!, abi: ERC20_ABI, functionName: "allowance", args: [account, plan.router],
        })) as bigint
        if (allowance < inWei) {
          await sendTx(`Approving ${from.symbol}`, () =>
            wc.writeContract({ address: from.address!, abi: ERC20_ABI, functionName: "approve", args: [plan.router, inWei] })
          )
        }
      }

      await sendTx(`Swap ${from.symbol} → ${to.symbol}`, () => {
        if (from.isNative) {
          return wc.writeContract({
            address: plan.router,
            abi: ROUTER_ABI,
            functionName: "swapExactETHForTokens",
            args: [minOut, plan.path, account, deadline],
            value: inWei,
          })
        }
        if (to.isNative) {
          return wc.writeContract({
            address: plan.router,
            abi: ROUTER_ABI,
            functionName: "swapExactTokensForETH",
            args: [inWei, minOut, plan.path, account, deadline],
          })
        }
        return wc.writeContract({
          address: plan.router,
          abi: ROUTER_ABI,
          functionName: "swapExactTokensForTokens",
          args: [inWei, minOut, plan.path, account, deadline],
        })
      })
      setRefreshKey((k) => k + 1)
    } catch (e) {
      const m = friendlyError(e)
      if (m) toast.error(m)
    } finally {
      setBusy(null)
    }
  }

  const canSwap =
    connected && !xmrInvolved && !!quoteOut && !!plan && !quoting && !quoteErr && amt > 0 && !overBalance && busy === null

  return (
    <div className="relative w-full rounded-xl border border-border bg-card/60 p-5 backdrop-blur-md">
      <TokenField
        label="You pay"
        token={from}
        amount={amountIn}
        editable
        onAmount={setAmountIn}
        onPick={() => setPicker(picker === "from" ? null : "from")}
        pickerOpen={picker === "from"}
        exclude={to}
        onSelect={(sym) => pick("from", sym)}
        onClosePicker={() => setPicker(null)}
        balance={fromBal}
        onMax={() => {
          if (fromBal == null) return
          const spendable = from.isNative
            ? fromBal > GAS_BUFFER ? fromBal - GAS_BUFFER : 0n
            : fromBal
          setAmountIn(formatUnits(spendable, from.decimals))
        }}
      />

      <div className="relative flex justify-center -my-2">
        <button
          onClick={flip}
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:rotate-180 hover:border-foreground/30 hover:text-foreground"
          style={{ transitionDuration: "300ms" }}
        >
          <ArrowDown className="size-4" />
        </button>
      </div>

      <TokenField
        label="You receive"
        token={to}
        amount={
          quoting ? "" : quoteOut != null ? fmtAmount(Number(formatUnits(quoteOut, to.decimals))) : ""
        }
        loading={quoting}
        onPick={() => setPicker(picker === "to" ? null : "to")}
        pickerOpen={picker === "to"}
        exclude={from}
        onSelect={(sym) => pick("to", sym)}
        onClosePicker={() => setPicker(null)}
      />

      <div className="mt-2 min-h-4 px-1 text-[11px]">
        {quoteErr ? (
          <span className="text-destructive">{quoteErr}</span>
        ) : rate ? (
          <span className="text-muted-foreground">
            1 {from.symbol} = {fmtAmount(rate)} {to.symbol}
            {plan && <span className="ml-2 opacity-70">· {venueLabel(plan)}</span>}
            <span className="ml-2 opacity-70">· 0.3% fee/hop</span>
          </span>
        ) : null}
      </div>

      {xmrInvolved && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" />
          Native Monero (XMR) swaps route through the ZeroFi bridge, which is coming soon. Until then,
          swap between the on-chain assets.
        </div>
      )}

      {!hasProvider && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground">
          <Wallet className="size-3.5" /> install MetaMask to swap on-chain.
        </div>
      )}

      {hasProvider && !account && (
        <button
          onClick={connectWallet}
          disabled={connecting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-3 text-sm font-bold uppercase tracking-wider text-background transition-all hover:bg-foreground/90 disabled:opacity-60"
        >
          {connecting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
          {connecting ? "check MetaMask…" : "Connect Wallet"}
        </button>
      )}

      {hasProvider && account && !onSepolia && (
        <button
          onClick={switchToSepolia}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-warning py-3 text-sm font-bold uppercase tracking-wider text-warning-foreground"
        >
          <AlertTriangle className="size-4" /> Switch to Sepolia
        </button>
      )}

      {connected && (
        <>
          <button
            onClick={doSwap}
            disabled={!canSwap}
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition-all",
              canSwap
                ? "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            )}
          >
            {busy === "swap" && <Loader2 className="size-4 animate-spin" />}
            {busy === "swap"
              ? "check MetaMask…"
              : xmrInvolved
                ? "Monero bridge coming soon"
                : overBalance
                  ? `insufficient ${from.symbol}`
                  : "Swap"}
            {canSwap && <ArrowRight className="size-4" />}
          </button>

          {from.hasFaucet && (
            <button
              onClick={faucet}
              disabled={busy !== null}
              className="mt-2 flex w-full items-center justify-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {busy === "faucet" ? <Loader2 className="size-3 animate-spin" /> : <Droplets className="size-3" />}
              mint test {from.symbol}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function TokenField({
  label, token, amount, editable, onAmount, onPick, loading, balance, onMax,
  pickerOpen, exclude, onSelect, onClosePicker,
}: {
  label: string
  token: SwapToken
  amount: string
  editable?: boolean
  onAmount?: (v: string) => void
  onPick: () => void
  loading?: boolean
  balance?: bigint | null
  onMax?: () => void
  pickerOpen: boolean
  exclude: SwapToken
  onSelect: (sym: string) => void
  onClosePicker: () => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <div className="flex rounded-lg border border-input bg-background/50">
        <div className="flex min-w-0 flex-1 items-center px-3 py-3">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : editable ? (
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmount?.(e.target.value)}
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent text-base font-semibold tabular-nums focus-visible:outline-none"
            />
          ) : (
            <span className="truncate text-base font-semibold tabular-nums text-muted-foreground">
              {amount || "0"}
            </span>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={onPick}
            className="flex h-full items-center gap-1.5 border-l border-input px-3 text-sm font-bold transition-colors hover:bg-white/5"
          >
            <CryptoIcon symbol={token.icon} size={18} />
            {token.symbol}
            {token.comingSoon && <span className="rounded-sm bg-warning/20 px-1 text-[8px] uppercase text-warning">soon</span>}
            <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", pickerOpen && "rotate-180")} />
          </button>
          {pickerOpen && (
            <TokenMenu exclude={exclude} onSelect={onSelect} onClose={onClosePicker} />
          )}
        </div>
      </div>
      {balance != null && (
        <div className="flex justify-end px-1 text-[10px] text-muted-foreground">
          balance {fmtAmount(Number(formatUnits(balance, token.decimals)))}
          {onMax && (
            <button onClick={onMax} className="ml-1.5 font-bold uppercase text-foreground/70 hover:text-foreground">
              max
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TokenMenu({
  exclude, onSelect, onClose,
}: {
  exclude: SwapToken
  onSelect: (sym: string) => void
  onClose: () => void
}) {
  const options = SWAP_TOKENS.filter(
    (t) =>
      t.symbol !== exclude.symbol &&
      !(t.address && exclude.address && t.address === exclude.address)
  )
  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={onClose} />
      <div
        className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
        style={{ animation: "fade-in-up 0.12s ease-out" }}
      >
        <div className="py-1">
          {options.map((t) => (
            <button
              key={t.symbol}
              onClick={() => onSelect(t.symbol)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <CryptoIcon symbol={t.icon} size={22} />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-bold text-foreground">{t.symbol}</span>
                <span className="truncate text-[10px] text-muted-foreground">{t.name}</span>
              </div>
              {t.comingSoon && (
                <span className="ml-auto shrink-0 rounded-sm bg-warning/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-warning">
                  soon
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
