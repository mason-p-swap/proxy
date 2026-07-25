

export const SIM_PARAMS = {
  maxLtv: 0.4,
  liquidationThreshold: 0.5,
  liquidationBonus: 0.07,
  closeFactor: 0.5,

  baseRate: 0.02,
  slope1: 0.06,
  slope2: 1.0,
  kink: 0.8,
}

export type SimState = {
  collateralPrice: number
  aliceSupply: number
  bobCollateral: number
  bobDebt: number
  years: number
}

export const INITIAL_SIM: SimState = {
  collateralPrice: 3_500,
  aliceSupply: 20_000,
  bobCollateral: 5,
  bobDebt: 5_000,
  years: 0,
}

export function collateralValue(s: SimState): number {
  return s.bobCollateral * s.collateralPrice
}

export function availableLiquidity(s: SimState): number {
  return Math.max(0, s.aliceSupply - s.bobDebt)
}

export function utilization(s: SimState): number {
  if (s.aliceSupply <= 0) return 0
  return Math.min(1, s.bobDebt / s.aliceSupply)
}

export function borrowRate(s: SimState): number {
  const u = utilization(s)
  const { baseRate, slope1, slope2, kink } = SIM_PARAMS
  if (u <= kink) return baseRate + (u * slope1) / kink
  const excess = (u - kink) / (1 - kink)
  return baseRate + slope1 + excess * slope2
}

export function supplyRate(s: SimState): number {
  return borrowRate(s) * utilization(s)
}

export function ltv(s: SimState): number {
  const cv = collateralValue(s)
  return cv > 0 ? s.bobDebt / cv : 0
}

export function healthFactor(s: SimState): number {
  if (s.bobDebt <= 0) return Infinity
  return (collateralValue(s) * SIM_PARAMS.liquidationThreshold) / s.bobDebt
}

export function maxBorrowable(s: SimState): number {
  const headroom = collateralValue(s) * SIM_PARAMS.maxLtv - s.bobDebt
  return Math.max(0, Math.min(headroom, availableLiquidity(s)))
}

export function liquidationPrice(s: SimState): number {
  if (s.bobCollateral <= 0 || s.bobDebt <= 0) return 0
  return s.bobDebt / (s.bobCollateral * SIM_PARAMS.liquidationThreshold)
}

export function accrueOneYear(s: SimState): SimState {
  const interest = s.bobDebt * borrowRate(s)
  return {
    ...s,
    bobDebt: s.bobDebt + interest,
    aliceSupply: s.aliceSupply + interest,
    years: s.years + 1,
  }
}

export type LiquidationResult = {
  state: SimState
  repaid: number
  seizedTokens: number
  seizedValue: number
  liquidatorProfit: number
}

export function liquidate(s: SimState): LiquidationResult {
  if (healthFactor(s) >= 1) {
    return { state: s, repaid: 0, seizedTokens: 0, seizedValue: 0, liquidatorProfit: 0 }
  }
  const repaid = s.bobDebt * SIM_PARAMS.closeFactor
  const seizeValue = repaid * (1 + SIM_PARAMS.liquidationBonus)
  let seizedTokens = seizeValue / s.collateralPrice
  if (seizedTokens > s.bobCollateral) seizedTokens = s.bobCollateral
  const seizedValue = seizedTokens * s.collateralPrice

  return {
    state: {
      ...s,
      bobDebt: s.bobDebt - repaid,
      bobCollateral: s.bobCollateral - seizedTokens,
    },
    repaid,
    seizedTokens,
    seizedValue,
    liquidatorProfit: seizedValue - repaid,
  }
}

export type RiskLevel = "none" | "safe" | "risky" | "danger"

export function riskLevel(s: SimState): RiskLevel {
  if (s.bobDebt <= 0) return "none"
  const hf = healthFactor(s)
  if (hf >= 1.5) return "safe"
  if (hf >= 1) return "risky"
  return "danger"
}
