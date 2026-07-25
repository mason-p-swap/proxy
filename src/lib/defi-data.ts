export type DefiMarket = {
  symbol: string
  name: string
  price: number
  supplyApy: number
  borrowApy: number
  tvl: number
  liquidity: number

  walletBalance: number

  collateralFactor: number

  liquidationThreshold: number
}

export const DEFI_MARKETS: DefiMarket[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    price: 3_521.8,
    supplyApy: 2.31,
    borrowApy: 3.88,
    tvl: 96_200_000,
    liquidity: 41_500_000,
    walletBalance: 3.42,
    collateralFactor: 0.75,
    liquidationThreshold: 0.82,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    price: 1.0,
    supplyApy: 3.94,
    borrowApy: 6.12,
    tvl: 84_500_000,
    liquidity: 52_100_000,
    walletBalance: 3_200,
    collateralFactor: 0.8,
    liquidationThreshold: 0.85,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    price: 1.0,
    supplyApy: 4.12,
    borrowApy: 6.45,
    tvl: 128_400_000,
    liquidity: 74_800_000,
    walletBalance: 8_450,
    collateralFactor: 0.8,
    liquidationThreshold: 0.85,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    price: 1.0,
    supplyApy: 4.38,
    borrowApy: 6.78,
    tvl: 112_700_000,
    liquidity: 68_400_000,
    walletBalance: 5_100,
    collateralFactor: 0.8,
    liquidationThreshold: 0.85,
  },
]

export const DEFI_MARKET_MAP = Object.fromEntries(DEFI_MARKETS.map((m) => [m.symbol, m]))

export const STABLES = new Set(["USDC", "USDT", "DAI"])
export function isStable(symbol: string): boolean {
  return STABLES.has(symbol)
}

export const PROTOCOL_STATS = {
  tvl: DEFI_MARKETS.reduce((s, m) => s + m.tvl, 0),
  totalBorrowed: DEFI_MARKETS.reduce((s, m) => s + (m.tvl - m.liquidity), 0),
  availableLiquidity: DEFI_MARKETS.reduce((s, m) => s + m.liquidity, 0),
  avgSupplyApy:
    DEFI_MARKETS.reduce((s, m) => s + m.supplyApy * m.tvl, 0) /
    DEFI_MARKETS.reduce((s, m) => s + m.tvl, 0),
}

export type DefiPosition = { symbol: string; amount: number }

export const PORTFOLIO = {
  supplied: [
    { symbol: "ETH", amount: 4 },
    { symbol: "DAI", amount: 2_500 },
  ] as DefiPosition[],
  borrowed: [{ symbol: "USDC", amount: 6_000 }] as DefiPosition[],
  interestEarned: 412.68,
}

export type DefiActivityType = "supply" | "borrow" | "interest" | "repay"

export type DefiActivity = {
  type: DefiActivityType
  symbol: string
  amount: number
  ts: number
}

const HOUR = 3_600_000

export const DEFI_ACTIVITY: DefiActivity[] = [
  { type: "interest", symbol: "ETH", amount: 0.008, ts: Date.now() - 2 * HOUR },
  { type: "borrow", symbol: "USDC", amount: 1_200, ts: Date.now() - 9 * HOUR },
  { type: "supply", symbol: "DAI", amount: 2_500, ts: Date.now() - 26 * HOUR },
  { type: "interest", symbol: "USDC", amount: 3.11, ts: Date.now() - 31 * HOUR },
  { type: "repay", symbol: "USDC", amount: 800, ts: Date.now() - 3 * 24 * HOUR },
  { type: "supply", symbol: "ETH", amount: 4, ts: Date.now() - 6 * 24 * HOUR },
]

export function positionUsd(p: DefiPosition): number {
  return p.amount * (DEFI_MARKET_MAP[p.symbol]?.price ?? 0)
}

export function suppliedUsd(): number {
  return PORTFOLIO.supplied.reduce((s, p) => s + positionUsd(p), 0)
}

export function borrowedUsd(): number {
  return PORTFOLIO.borrowed.reduce((s, p) => s + positionUsd(p), 0)
}

export function collateralPowerUsd(): number {
  return PORTFOLIO.supplied.reduce(
    (s, p) => s + positionUsd(p) * (DEFI_MARKET_MAP[p.symbol]?.liquidationThreshold ?? 0),
    0
  )
}

export function healthFactor(collateralPower: number, borrowed: number): number {
  if (borrowed <= 0) return Infinity
  return collateralPower / borrowed
}

export function netApy(): number {
  const supplied = suppliedUsd()
  const borrowed = borrowedUsd()
  if (supplied === 0) return 0
  const earnedUsdPerYear = PORTFOLIO.supplied.reduce(
    (s, p) => s + positionUsd(p) * ((DEFI_MARKET_MAP[p.symbol]?.supplyApy ?? 0) / 100),
    0
  )
  const paidUsdPerYear = PORTFOLIO.borrowed.reduce(
    (s, p) => s + positionUsd(p) * ((DEFI_MARKET_MAP[p.symbol]?.borrowApy ?? 0) / 100),
    0
  )
  const netWorth = supplied - borrowed
  return ((earnedUsdPerYear - paidUsdPerYear) / (netWorth || supplied)) * 100
}
