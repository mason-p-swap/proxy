import { useCallback, useEffect, useState } from "react"
import { formatUnits, parseUnits } from "viem"
import { toast } from "sonner"
import {
  ADDR, EXPLORER, publicClient, walletClient,
  ERC20_ABI, POOL_ABI, ORACLE_ABI,
  MAX_UINT, USDC_DECIMALS, WETH_DECIMALS, WAD,
} from "@/lib/web3"
import { useWallet, connectWallet, switchToSepolia } from "@/hooks/use-wallet"
import { CryptoIcon } from "@/components/crypto-icon"
import { fmtAmount, fmtUsd } from "@/lib/format"
import { ExternalLink, Wallet, AlertTriangle, Loader2, Droplets, ArrowRight, Gauge, Skull } from "lucide-react"
import { cn } from "@/lib/utils"

type MarketData = {
  supplied: bigint
  borrowed: bigint
  liquidity: bigint
  collateral: bigint
  util: bigint
  supplyApr: bigint
  borrowApr: bigint
  wethPrice: bigint
}

type UserData = {
  supplyBalance: bigint
  debtBalance: bigint
  collateralBalance: bigint
  collateralUsd: bigint
  debtUsd: bigint
  hf: bigint
  maxBorrow: bigint
  liqPrice: bigint
  wethBalance: bigint
  usdcBalance: bigint
}

type ActionKey = "depositCollateral" | "withdrawCollateral" | "borrow" | "repay" | "supply" | "withdrawSupply"

const ACTIONS: {
  key: ActionKey
  label: string
  token: "weth" | "usdc"

  approves: boolean
  help: string
}[] = [
  { key: "depositCollateral", label: "Deposit WETH", token: "weth", approves: true, help: "lock WETH as collateral so you can borrow against it" },
  { key: "borrow", label: "Borrow USDC", token: "usdc", approves: false, help: "borrow up to 40% of your collateral value" },
  { key: "repay", label: "Repay USDC", token: "usdc", approves: true, help: "pay back debt (plus accrued interest)" },
  { key: "withdrawCollateral", label: "Withdraw WETH", token: "weth", approves: false, help: "take collateral out — only what your debt allows" },
  { key: "supply", label: "Lend USDC", token: "usdc", approves: true, help: "supply USDC to the pool and earn the supply APR" },
  { key: "withdrawSupply", label: "Withdraw USDC", token: "usdc", approves: false, help: "pull your lent USDC back out (plus earned interest)" },
]

const WAD_F = (v: bigint, digits = 2) => Number(formatUnits(v, 18)).toFixed(digits)

export function LiveMarket() {
  const { hasProvider, account, connecting, onSepolia } = useWallet()
  const [market, setMarket] = useState<MarketData | null>(null)
  const [user, setUser] = useState<UserData | null>(null)
  const [action, setAction] = useState<ActionKey>("depositCollateral")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [oracleOwner, setOracleOwner] = useState<string | null>(null)
  const [customPrice, setCustomPrice] = useState("")
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    publicClient
      .readContract({ address: ADDR.oracle, abi: ORACLE_ABI, functionName: "owner" })
      .then((o) => setOracleOwner(o))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [m, price] = await Promise.all([
          publicClient.readContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "getMarketData" }),
          publicClient.readContract({ address: ADDR.oracle, abi: ORACLE_ABI, functionName: "getPrice", args: [ADDR.weth] }),
        ])
        if (!alive) return
        const [supplied, borrowed, liquidity, collateral, util, supplyApr, borrowApr] = m
        setMarket({ supplied, borrowed, liquidity, collateral, util, supplyApr, borrowApr, wethPrice: price })
      } catch {

      }
    }
    load()
    const t = setInterval(load, 15_000)
    return () => { alive = false; clearInterval(t) }
  }, [refreshKey])

  useEffect(() => {
    if (!account) { setUser(null); return }
    let alive = true
    const load = async () => {
      try {
        const [u, liqPrice, wethBalance, usdcBalance] = await Promise.all([
          publicClient.readContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "getUserData", args: [account] }),
          publicClient.readContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "liquidationPrice", args: [account] }),
          publicClient.readContract({ address: ADDR.weth, abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
          publicClient.readContract({ address: ADDR.usdc, abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
        ])
        if (!alive) return
        const [supplyBalance, debtBalance, collateralBalance, collateralUsd, debtUsd, hf, maxBorrow] = u
        setUser({ supplyBalance, debtBalance, collateralBalance, collateralUsd, debtUsd, hf, maxBorrow, liqPrice, wethBalance, usdcBalance })
      } catch {

      }
    }
    load()
    const t = setInterval(load, 15_000)
    return () => { alive = false; clearInterval(t) }
  }, [account, refreshKey])

  const sendTx = async (label: string, fn: () => Promise<`0x${string}`>) => {
    const hash = await fn()
    toast.loading(`${label} — waiting for Sepolia…`, { id: hash })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== "success") {
      toast.error(`${label} reverted on-chain`, { id: hash })
      throw new Error("reverted")
    }
    toast.success(
      <span>
        {label} confirmed ·{" "}
        <a className="underline" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">
          view on explorer
        </a>
      </span>,
      { id: hash }
    )
  }

  const friendlyError = (e: any): string | null => {
    const msg = String(e?.shortMessage ?? e?.message ?? e)
    if (/denied|rejected/i.test(msg)) return null
    return msg.split("\n")[0].slice(0, 140)
  }

  const mint = async (token: "weth" | "usdc") => {
    if (!account) return
    setBusy(`mint-${token}`)
    try {
      const wc = walletClient(account)
      await sendTx(
        `Minting test ${token.toUpperCase()}`,
        () => wc.writeContract({ address: ADDR[token], abi: ERC20_ABI, functionName: "faucet" })
      )
      refresh()
    } catch (e) {
      const msg = friendlyError(e)
      if (msg) toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  const submit = async () => {
    if (!account || !amount) return
    const def = ACTIONS.find((a) => a.key === action)!
    const decimals = def.token === "weth" ? WETH_DECIMALS : USDC_DECIMALS
    let amt: bigint
    try {
      amt = parseUnits(amount as `${number}`, decimals)
      if (amt <= 0n) return
    } catch {
      toast.error("that amount doesn't parse")
      return
    }
    setBusy("submit")
    try {
      const wc = walletClient(account)

      if (def.approves) {
        const tokenAddr = ADDR[def.token]
        const allowance = await publicClient.readContract({
          address: tokenAddr, abi: ERC20_ABI, functionName: "allowance", args: [account, ADDR.pool],
        })
        if (allowance < amt) {
          await sendTx(
            `Approving ${def.token.toUpperCase()}`,
            () => wc.writeContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "approve", args: [ADDR.pool, amt] })
          )
        }
      }

      const write = () => {
        switch (action) {
          case "depositCollateral":
            return wc.writeContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "depositCollateral", args: [amt] })
          case "withdrawCollateral":
            return wc.writeContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "withdrawCollateral", args: [amt] })
          case "borrow":
            return wc.writeContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "borrow", args: [amt] })
          case "repay":
            return wc.writeContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "repay", args: [amt, account] })
          case "supply":
            return wc.writeContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "supply", args: [amt] })
          case "withdrawSupply":
            return wc.writeContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "withdraw", args: [amt] })
        }
      }
      await sendTx(def.label, write)
      setAmount("")
      refresh()
    } catch (e) {
      const msg = friendlyError(e)
      if (msg) toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  const setOraclePrice = async (priceUsd: number) => {
    if (!account || !(priceUsd > 0)) return
    setBusy("oracle")
    try {
      const wc = walletClient(account)
      const price8 = BigInt(Math.round(priceUsd * 1e8))
      await sendTx(
        `Setting WETH oracle price to ${fmtUsd(priceUsd)}`,
        () => wc.writeContract({ address: ADDR.oracle, abi: ORACLE_ABI, functionName: "setPrice", args: [ADDR.weth, price8] })
      )
      setCustomPrice("")
      refresh()
    } catch (e) {
      const msg = friendlyError(e)
      if (msg) toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  const liquidateSelf = async () => {
    if (!account || !user) return
    const maxRepay = user.debtBalance / 2n
    const repay = maxRepay < user.usdcBalance ? maxRepay : user.usdcBalance
    if (repay <= 0n) {
      toast.error("you need USDC in your wallet to repay the debt with")
      return
    }
    setBusy("liquidate")
    try {
      const wc = walletClient(account)
      const allowance = await publicClient.readContract({
        address: ADDR.usdc, abi: ERC20_ABI, functionName: "allowance", args: [account, ADDR.pool],
      })
      if (allowance < repay) {
        await sendTx(
          "Approving USDC for the liquidation",
          () => wc.writeContract({ address: ADDR.usdc, abi: ERC20_ABI, functionName: "approve", args: [ADDR.pool, repay] })
        )
      }
      await sendTx(
        `Liquidating — repaying ${fmtAmount(Number(formatUnits(repay, USDC_DECIMALS)))} USDC`,
        () => wc.writeContract({ address: ADDR.pool, abi: POOL_ABI, functionName: "liquidate", args: [account, repay] })
      )
      refresh()
    } catch (e) {
      const msg = friendlyError(e)
      if (msg) toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  const isOracleOwner = Boolean(
    account && oracleOwner && account.toLowerCase() === oracleOwner.toLowerCase()
  )
  const liquidatable = Boolean(user && user.debtBalance > 0n && user.hf < WAD)

  const def = ACTIONS.find((a) => a.key === action)!
  const maxFor = (key: ActionKey): bigint => {
    if (!user) return 0n
    switch (key) {
      case "depositCollateral": return user.wethBalance
      case "withdrawCollateral": return user.collateralBalance
      case "borrow": return user.maxBorrow
      case "repay": return user.debtBalance < user.usdcBalance ? user.debtBalance : user.usdcBalance
      case "supply": return user.usdcBalance
      case "withdrawSupply": return user.supplyBalance
    }
  }
  const maxAmt = maxFor(action)
  const decimals = def.token === "weth" ? WETH_DECIMALS : USDC_DECIMALS

  const hfDisplay = user
    ? user.hf === MAX_UINT ? "∞" : WAD_F(user.hf)
    : "—"
  const hfColor = !user || user.hf === MAX_UINT
    ? "text-success"
    : Number(formatUnits(user.hf, 18)) >= 1.5 ? "text-success"
    : Number(formatUnits(user.hf, 18)) >= 1.1 ? "text-warning"
    : "text-destructive"

  return (
    <div className="mb-12 overflow-hidden rounded-xl border border-success/30 bg-card/60 backdrop-blur-md" style={{ animation: "fade-in-up 0.5s ease-out 0.1s both" }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="flex items-center gap-1.5 rounded-sm border border-success/50 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
          <span className="size-1.5 animate-pulse rounded-full bg-success" />
          live on sepolia
        </span>
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <CryptoIcon symbol="ETH" size={18} />
          WETH
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <CryptoIcon symbol="USDC" size={18} />
          USDC
        </div>
        <span className="text-[11px] text-muted-foreground">· your deployment, on a public chain</span>
        <a
          href={`${EXPLORER}/address/${ADDR.pool}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          contract <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border/40 sm:grid-cols-3 md:grid-cols-6">
        {[
          { label: "WETH oracle price", value: market ? fmtUsd(Number(market.wethPrice) / 1e8) : "…" },
          { label: "USDC supplied", value: market ? fmtAmount(Number(formatUnits(market.supplied, USDC_DECIMALS))) : "…" },
          { label: "USDC borrowed", value: market ? fmtAmount(Number(formatUnits(market.borrowed, USDC_DECIMALS))) : "…" },
          { label: "WETH collateral", value: market ? fmtAmount(Number(formatUnits(market.collateral, WETH_DECIMALS))) : "…" },
          { label: "supply APR", value: market ? `${WAD_F(market.supplyApr * 100n)}%` : "…" },
          { label: "borrow APR", value: market ? `${WAD_F(market.borrowApr * 100n)}%` : "…" },
        ].map((s) => (
          <div key={s.label} className="bg-card/80 p-3">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 text-sm font-bold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {!hasProvider && (
        <div className="flex items-center gap-3 p-5 text-xs text-muted-foreground">
          <Wallet className="size-4" />
          install the MetaMask extension to interact with this market — the stats above are read straight from the chain either way.
        </div>
      )}

      {hasProvider && !account && (
        <div className="flex flex-col items-center gap-3 p-8">
          <p className="text-xs text-muted-foreground">connect your wallet to deposit, borrow, and lend on your own protocol.</p>
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-background transition-all hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-60"
          >
            {connecting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
            {connecting ? "check the MetaMask popup…" : "Connect Wallet"}
          </button>
        </div>
      )}

      {hasProvider && account && !onSepolia && (
        <div className="flex flex-col items-center gap-3 p-8">
          <p className="flex items-center gap-2 text-xs text-warning">
            <AlertTriangle className="size-4" /> your wallet is on the wrong network.
          </p>
          <button
            onClick={switchToSepolia}
            className="rounded-lg bg-foreground px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-background transition-all hover:bg-foreground/90"
          >
            Switch to Sepolia
          </button>
        </div>
      )}

      {hasProvider && account && onSepolia && (
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">your wallet</div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { sym: "WETH", icon: "ETH", bal: user?.wethBalance, dec: WETH_DECIMALS, token: "weth" as const },
                  { sym: "USDC", icon: "USDC", bal: user?.usdcBalance, dec: USDC_DECIMALS, token: "usdc" as const },
                ]).map((t) => (
                  <div key={t.sym} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex items-center gap-2">
                      <CryptoIcon symbol={t.icon} size={20} />
                      <span className="text-sm font-bold tabular-nums">
                        {user ? fmtAmount(Number(formatUnits(t.bal!, t.dec))) : "…"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{t.sym}</span>
                    </div>
                    <button
                      onClick={() => mint(t.token)}
                      disabled={busy !== null}
                      className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      {busy === `mint-${t.token}` ? <Loader2 className="size-3 animate-spin" /> : <Droplets className="size-3" />}
                      mint test {t.sym}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">your position</div>
              <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3 text-xs">
                <PosRow label="collateral" value={user ? `${fmtAmount(Number(formatUnits(user.collateralBalance, WETH_DECIMALS)))} WETH · ${fmtUsd(Number(formatUnits(user.collateralUsd, 18)))}` : "…"} />
                <PosRow label="debt" value={user ? `${fmtAmount(Number(formatUnits(user.debtBalance, USDC_DECIMALS)))} USDC` : "…"} />
                <PosRow label="lent (earning)" value={user ? `${fmtAmount(Number(formatUnits(user.supplyBalance, USDC_DECIMALS)))} USDC` : "…"} />
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">health factor</span>
                  <span className={cn("font-bold tabular-nums", hfColor)}>{hfDisplay}</span>
                </div>
                {user && user.liqPrice > 0n && (
                  <PosRow label="liquidation at" value={`WETH ${fmtUsd(Number(user.liqPrice) / 1e8)}`} warn />
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">act</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => { setAction(a.key); setAmount("") }}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    action === a.key ? "bg-white/10 font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <p className="mb-3 text-[11px] text-muted-foreground">{def.help}.</p>

            <div className="flex rounded-lg border border-input bg-background/50">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-semibold tabular-nums focus-visible:outline-none"
              />
              <button
                onClick={() => setAmount(formatUnits(maxAmt, decimals))}
                className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                max
              </button>
              <span className="flex items-center border-l border-input px-3 text-xs font-bold">
                {def.token.toUpperCase()}
              </span>
            </div>
            <div className="mt-1 px-1 text-[10px] text-muted-foreground">
              available: {fmtAmount(Number(formatUnits(maxAmt, decimals)))} {def.token.toUpperCase()}
            </div>

            <button
              onClick={submit}
              disabled={busy !== null || !amount || parseFloat(amount) <= 0}
              className={cn(
                "mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold uppercase tracking-wider transition-all",
                busy === null && amount && parseFloat(amount) > 0
                  ? "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
                  : "cursor-not-allowed bg-muted text-muted-foreground"
              )}
            >
              {busy === "submit" && <Loader2 className="size-4 animate-spin" />}
              {busy === "submit" ? "check MetaMask…" : def.label}
            </button>

            {def.approves && (
              <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">
                this action may show two MetaMask popups: first an approval letting the pool pull your {def.token.toUpperCase()}, then the {def.label.toLowerCase()} itself.
              </p>
            )}
          </div>
        </div>
      )}

      {hasProvider && account && onSepolia && liquidatable && user && (
        <div className="mx-5 mb-5 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <Skull className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-destructive">position liquidatable — health factor below 1.0</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                your collateral no longer covers your debt at the liquidation threshold. on mainnet,
                bots would race to take this. here, you can play the liquidator yourself: repay up to
                half the debt ({fmtAmount(Number(formatUnits(user.debtBalance / 2n, USDC_DECIMALS)))} USDC)
                and seize the equivalent WETH plus a 7% bonus.
              </p>
              <button
                onClick={liquidateSelf}
                disabled={busy !== null}
                className="mt-3 flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-destructive/90 active:scale-[0.98] disabled:opacity-60"
              >
                {busy === "liquidate" && <Loader2 className="size-3.5 animate-spin" />}
                {busy === "liquidate" ? "check MetaMask…" : "liquidate this position"}
              </button>
            </div>
          </div>
        </div>
      )}

      {hasProvider && account && onSepolia && isOracleOwner && (
        <div className="mx-5 mb-5 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Gauge className="size-4 text-warning" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-warning">oracle control · owner only</span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            you own the price oracle. move the WETH price and every position in the pool reprices
            instantly — drop it below your liquidation price and your own position becomes liquidatable.
            this is the simulator&apos;s price slider, except it&apos;s a real transaction on a real chain.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "crash to $1,900", value: 1900, danger: true },
              { label: "dip to $2,500", value: 2500, danger: false },
              { label: "restore $3,500", value: 3500, danger: false },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setOraclePrice(p.value)}
                disabled={busy !== null}
                className={cn(
                  "rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50",
                  p.danger
                    ? "border-destructive/50 text-destructive hover:bg-destructive/10"
                    : "border-border text-foreground hover:border-foreground/30"
                )}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="custom $"
                className="h-8 w-24 rounded-lg border border-input bg-background/50 px-2 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <button
                onClick={() => setOraclePrice(parseFloat(customPrice) || 0)}
                disabled={busy !== null || !(parseFloat(customPrice) > 0)}
                className="h-8 rounded-lg border border-border px-2.5 text-[11px] font-bold uppercase tracking-wider text-foreground transition-colors hover:border-foreground/30 disabled:opacity-50"
              >
                {busy === "oracle" ? <Loader2 className="size-3 animate-spin" /> : "set"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PosRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", warn && "text-warning")}>{value}</span>
    </div>
  )
}
