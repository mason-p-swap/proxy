import { useCallback, useEffect, useMemo, useState } from "react"
import { formatUnits, parseUnits } from "viem"
import { toast } from "sonner"
import React from "react"
import {
  ADDR_V2, EXPLORER, MARKET_ASSETS, publicClient, walletClient,
  ERC20_ABI, MARKET_ABI, ORACLE_ABI,
  MAX_UINT, WAD, type MarketAssetKey,
} from "@/lib/web3"
import { useWallet } from "@/hooks/use-wallet"
import { fmtAmount, fmtUsd } from "@/lib/format"

export type ReserveData = {
  supplied: bigint
  borrowed: bigint
  liquidity: bigint
  util: bigint
  supplyApr: bigint
  borrowApr: bigint
  price: bigint
}

export type ReserveConfig = {
  ltvBps: number
  liqThresholdBps: number
  liqBonusBps: number
  reserveFactorBps: number

  baseRate: number
  slope1: number
  slope2: number
  optimalUtil: number
}

export type UserReserve = {
  supplyBalance: bigint
  debtBalance: bigint
  usingAsCollateral: boolean
  walletBalance: bigint
}

export type AccountData = {
  collateralUsd: bigint
  debtUsd: bigint
  powerUsd: bigint
  availableUsd: bigint
  hf: bigint
}

export type ActionKey = "supply" | "withdraw" | "borrow" | "repay"

export const ACTION_META: Record<ActionKey, { title: string; approves: boolean; help: string }> = {
  supply: { title: "Supply", approves: true, help: "supply to earn the APY; counts as collateral unless you toggle it off" },
  withdraw: { title: "Withdraw", approves: false, help: "pull your supplied assets back out — limited by what your debt allows" },
  borrow: { title: "Borrow", approves: false, help: "borrow against your collateral, up to your borrow power" },
  repay: { title: "Repay", approves: true, help: "pay debt down (plus accrued interest)" },
}

export const pct = (wadValue: bigint) => `${Number(formatUnits(wadValue * 100n, 18)).toFixed(2)}%`
export const usdOf = (units: bigint, decimals: number, price: bigint) =>
  Number(formatUnits(units, decimals)) * (Number(price) / 1e8)

export function hfDisplayOf(hf: bigint | null): string {
  return hf == null ? "—" : hf === MAX_UINT ? "∞" : Number(formatUnits(hf, 18)).toFixed(2)
}

export function hfColorOf(hf: bigint | null): string {
  if (hf == null || hf === MAX_UINT || Number(formatUnits(hf, 18)) >= 1.5) return "text-success"
  return Number(formatUnits(hf, 18)) >= 1.1 ? "text-warning" : "text-destructive"
}

export function useMoneyMarket() {
  const wallet = useWallet()
  const { account } = wallet
  const [reserves, setReserves] = useState<Partial<Record<MarketAssetKey, ReserveData>>>({})
  const [configs, setConfigs] = useState<Partial<Record<MarketAssetKey, ReserveConfig>>>({})
  const [userReserves, setUserReserves] = useState<Partial<Record<MarketAssetKey, UserReserve>>>({})
  const [accountData, setAccountData] = useState<AccountData | null>(null)
  const [oracleOwner, setOracleOwner] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    publicClient
      .readContract({ address: ADDR_V2.oracle, abi: ORACLE_ABI, functionName: "owner" })
      .then(setOracleOwner)
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all(
      MARKET_ASSETS.map((a) =>
        publicClient.readContract({
          address: ADDR_V2.market, abi: MARKET_ABI, functionName: "configOf", args: [ADDR_V2[a.key]],
        })
      )
    )
      .then((results) => {
        if (!alive) return
        const next: Partial<Record<MarketAssetKey, ReserveConfig>> = {}
        MARKET_ASSETS.forEach((a, i) => {
          const [ltvBps, liqThresholdBps, liqBonusBps, reserveFactorBps, baseRate, slope1, slope2, optimalUtil] = results[i]
          next[a.key] = {
            ltvBps, liqThresholdBps, liqBonusBps, reserveFactorBps,
            baseRate: Number(formatUnits(baseRate, 18)),
            slope1: Number(formatUnits(slope1, 18)),
            slope2: Number(formatUnits(slope2, 18)),
            optimalUtil: Number(formatUnits(optimalUtil, 18)),
          }
        })
        setConfigs(next)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const results = await Promise.all(
          MARKET_ASSETS.map((a) =>
            publicClient
              .readContract({
                address: ADDR_V2.market, abi: MARKET_ABI, functionName: "getReserveData", args: [ADDR_V2[a.key]],
              })
              .catch(() => null)
          )
        )
        if (!alive) return
        const next: Partial<Record<MarketAssetKey, ReserveData>> = {}
        MARKET_ASSETS.forEach((a, i) => {
          const r = results[i]
          if (!r) return
          const [supplied, borrowed, liquidity, util, supplyApr, borrowApr, price] = r
          next[a.key] = { supplied, borrowed, liquidity, util, supplyApr, borrowApr, price }
        })
        setReserves(next)
      } catch {

      }
    }
    load()
    const t = setInterval(load, 15_000)
    return () => { alive = false; clearInterval(t) }
  }, [refreshKey])

  useEffect(() => {
    if (!account) { setUserReserves({}); setAccountData(null); return }
    let alive = true
    const load = async () => {
      try {
        const [acct, ...perAsset] = await Promise.all([
          publicClient.readContract({
            address: ADDR_V2.market, abi: MARKET_ABI, functionName: "getUserAccountData", args: [account],
          }),
          ...MARKET_ASSETS.flatMap((a) => [
            publicClient
              .readContract({
                address: ADDR_V2.market, abi: MARKET_ABI, functionName: "getUserReserveData", args: [ADDR_V2[a.key], account],
              })
              .catch(() => null),
            publicClient
              .readContract({
                address: ADDR_V2[a.key], abi: ERC20_ABI, functionName: "balanceOf", args: [account],
              })
              .catch(() => null),
          ]),
        ])
        if (!alive) return
        const [collateralUsd, debtUsd, powerUsd, availableUsd, hf] =
          acct as readonly [bigint, bigint, bigint, bigint, bigint]
        setAccountData({ collateralUsd, debtUsd, powerUsd, availableUsd, hf })
        const next: Partial<Record<MarketAssetKey, UserReserve>> = {}
        MARKET_ASSETS.forEach((a, i) => {
          const reserve = perAsset[i * 2]
          if (!reserve) return
          const [supplyBalance, debtBalance, usingAsCollateral] =
            reserve as readonly [bigint, bigint, boolean]
          next[a.key] = {
            supplyBalance, debtBalance, usingAsCollateral,
            walletBalance: (perAsset[i * 2 + 1] as bigint | null) ?? 0n,
          }
        })
        setUserReserves(next)
      } catch {

      }
    }
    load()
    const t = setInterval(load, 15_000)
    return () => { alive = false; clearInterval(t) }
  }, [account, refreshKey])

  const sendTx = useCallback(async (label: string, fn: () => Promise<`0x${string}`>) => {
    const hash = await fn()
    toast.loading(`${label} — waiting for Sepolia…`, { id: hash })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== "success") {
      toast.error(`${label} reverted on-chain`, { id: hash })
      throw new Error("reverted")
    }
    toast.success(
      React.createElement(
        "span", null,
        `${label} confirmed · `,
        React.createElement("a", {
          className: "underline",
          href: `${EXPLORER}/tx/${hash}`,
          target: "_blank",
          rel: "noreferrer",
        }, "explorer")
      ),
      { id: hash }
    )
  }, [])

  const friendlyError = (e: any): string | null => {
    const msg = String(e?.shortMessage ?? e?.message ?? e)
    if (/denied|rejected/i.test(msg)) return null

    const lines = msg.split("\n").map((l) => l.trim()).filter(Boolean)
    const text = lines[0]?.endsWith(":") && lines[1] ? `${lines[0]} ${lines[1]}` : lines[0] ?? "transaction failed"
    return text.slice(0, 200)
  }

  const runGuarded = useCallback(async (key: string, fn: () => Promise<void>): Promise<boolean> => {
    setBusy(key)
    try {
      await fn()
      refresh()
      return true
    } catch (e) {
      const msg = friendlyError(e)
      if (msg) toast.error(msg)
      return false
    } finally {
      setBusy(null)
    }
  }, [refresh])

  const mint = useCallback((key: MarketAssetKey) => {
    if (!account) return
    const meta = MARKET_ASSETS.find((a) => a.key === key)!
    return runGuarded(`mint-${key}`, async () => {
      const wc = walletClient(account)
      await sendTx(
        `Minting test ${meta.symbol}`,
        () => wc.writeContract({ address: ADDR_V2[key], abi: ERC20_ABI, functionName: "faucet" })
      )
    })
  }, [account, runGuarded, sendTx])

  const toggleCollateral = useCallback((key: MarketAssetKey, enabled: boolean) => {
    if (!account) return
    const meta = MARKET_ASSETS.find((a) => a.key === key)!
    return runGuarded(`toggle-${key}`, async () => {
      const wc = walletClient(account)
      await sendTx(
        `${enabled ? "Enabling" : "Disabling"} ${meta.symbol} as collateral`,
        () => wc.writeContract({
          address: ADDR_V2.market, abi: MARKET_ABI, functionName: "setUseAsCollateral", args: [ADDR_V2[key], enabled],
        })
      )
    })
  }, [account, runGuarded, sendTx])

  const act = useCallback(async (asset: MarketAssetKey, action: ActionKey, amountText: string, useMax = false): Promise<boolean> => {
    if (!account || !amountText) return false
    const meta = MARKET_ASSETS.find((a) => a.key === asset)!
    const def = ACTION_META[action]
    let amt: bigint
    try {
      amt = parseUnits(amountText as `${number}`, meta.decimals)
      if (amt <= 0n) return false
    } catch {
      toast.error("that amount doesn't parse")
      return false
    }
    const sendSentinel = useMax && (action === "repay" || action === "withdraw")
    return runGuarded("act", async () => {
      const wc = walletClient(account)
      const assetAddr = ADDR_V2[asset]

      if (def.approves) {

        const approveAmt = sendSentinel ? (amt * 101n) / 100n : amt
        const allowance = await publicClient.readContract({
          address: assetAddr, abi: ERC20_ABI, functionName: "allowance", args: [account, ADDR_V2.market],
        })
        if (allowance < approveAmt) {
          await sendTx(
            `Approving ${meta.symbol}`,
            () => wc.writeContract({ address: assetAddr, abi: ERC20_ABI, functionName: "approve", args: [ADDR_V2.market, approveAmt] })
          )
        }
      }

      const arg = sendSentinel ? MAX_UINT : amt
      const label = sendSentinel
        ? `${def.title} all ${meta.symbol}`
        : `${def.title} ${fmtAmount(Number(formatUnits(amt, meta.decimals)))} ${meta.symbol}`
      const write = () => {
        switch (action) {
          case "supply":
            return wc.writeContract({ address: ADDR_V2.market, abi: MARKET_ABI, functionName: "supply", args: [assetAddr, amt] })
          case "withdraw":
            return wc.writeContract({ address: ADDR_V2.market, abi: MARKET_ABI, functionName: "withdraw", args: [assetAddr, arg] })
          case "borrow":
            return wc.writeContract({ address: ADDR_V2.market, abi: MARKET_ABI, functionName: "borrow", args: [assetAddr, amt] })
          case "repay":
            return wc.writeContract({ address: ADDR_V2.market, abi: MARKET_ABI, functionName: "repay", args: [assetAddr, arg, account] })
        }
      }
      await sendTx(label, write)
    })
  }, [account, runGuarded, sendTx])

  const setOraclePrice = useCallback((key: MarketAssetKey, priceUsd: number) => {
    if (!account || !(priceUsd > 0)) return
    const meta = MARKET_ASSETS.find((a) => a.key === key)!
    return runGuarded(`price-${key}`, async () => {
      const wc = walletClient(account)
      await sendTx(
        `Setting ${meta.symbol} price to ${fmtUsd(priceUsd)}`,
        () => wc.writeContract({
          address: ADDR_V2.oracle, abi: ORACLE_ABI, functionName: "setPrice",
          args: [ADDR_V2[key], BigInt(Math.round(priceUsd * 1e8))],
        })
      )
    })
  }, [account, runGuarded, sendTx])

  const maxFor = useCallback((asset: MarketAssetKey, action: ActionKey): bigint => {
    const meta = MARKET_ASSETS.find((a) => a.key === asset)!
    const u = userReserves[asset]
    const r = reserves[asset]
    if (!u || !r) return 0n
    switch (action) {
      case "supply": return u.walletBalance
      case "withdraw": return u.supplyBalance
      case "repay": return u.debtBalance < u.walletBalance ? u.debtBalance : u.walletBalance
      case "borrow": {
        if (!accountData) return 0n
        const availUsd = Number(formatUnits(accountData.availableUsd, 18))
        const price = Number(r.price) / 1e8
        if (price <= 0) return 0n
        const byPower = parseUnits(
          (Math.max(0, availUsd / price) * 0.9995).toFixed(meta.decimals) as `${number}`,
          meta.decimals
        )
        return byPower < r.liquidity ? byPower : r.liquidity
      }
    }
  }, [userReserves, reserves, accountData])

  const stats = useMemo(() => {
    let tvl = 0, borrowed = 0, liquidity = 0
    for (const a of MARKET_ASSETS) {
      const r = reserves[a.key]
      if (!r) continue
      tvl += usdOf(r.supplied, a.decimals, r.price)
      borrowed += usdOf(r.borrowed, a.decimals, r.price)
      liquidity += usdOf(r.liquidity, a.decimals, r.price)
    }
    return { tvl, borrowed, liquidity }
  }, [reserves])

  const connected = wallet.hasProvider && Boolean(account) && wallet.onSepolia
  const isOracleOwner = Boolean(account && oracleOwner && account.toLowerCase() === oracleOwner.toLowerCase())
  const hf = accountData?.hf ?? null
  const liquidatable = Boolean(accountData && accountData.debtUsd > 0n && accountData.hf < WAD)
  const powerUsedPct = accountData && accountData.powerUsd > 0n
    ? Math.min(100, (Number(formatUnits(accountData.debtUsd, 18)) / Number(formatUnits(accountData.powerUsd, 18))) * 100)
    : 0

  return {
    ...wallet,
    connected,
    reserves,
    configs,
    userReserves,
    accountData,
    stats,
    hf,
    liquidatable,
    powerUsedPct,
    isOracleOwner,
    busy,
    refresh,
    mint,
    toggleCollateral,
    act,
    setOraclePrice,
    maxFor,
  }
}

export type MoneyMarket = ReturnType<typeof useMoneyMarket>
