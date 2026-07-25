import { createPublicClient, createWalletClient, custom, http, parseAbi, type Address } from "viem"
import { sepolia } from "viem/chains"

export const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"
export const SEPOLIA_CHAIN_ID = sepolia.id

export const ADDR = {
  weth: "0x5b345423366e82a2ea1c0ba47a6036748c56780f" as Address,
  usdc: "0xd60aa27fc84970d01c21f876d6cd612ef265adad" as Address,
  oracle: "0xb08dd03a5a741d092e7747192dac82394c5c1d06" as Address,
  pool: "0x08baf060638af6069bce0809f445f7575fa86ae1" as Address,
} as const

export const EXPLORER = "https://eth-sepolia.blockscout.com"

export const publicClient = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) })

export function walletClient(account: Address) {
  return createWalletClient({ chain: sepolia, transport: custom(window.ethereum!), account })
}

export const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function faucet()",
])

export const POOL_ABI = parseAbi([
  "function getMarketData() view returns (uint256 supplied, uint256 borrowed, uint256 liquidity, uint256 collateral, uint256 util, uint256 supplyApr, uint256 borrowApr)",
  "function getUserData(address user) view returns (uint256 supplyBalance, uint256 debtBalance, uint256 collateralBalance, uint256 collateralUsd, uint256 debtUsd, uint256 hf, uint256 maxBorrow)",
  "function liquidationPrice(address user) view returns (uint256)",
  "function supply(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function depositCollateral(uint256 amount)",
  "function withdrawCollateral(uint256 amount)",
  "function borrow(uint256 amount)",
  "function repay(uint256 amount, address onBehalfOf)",
  "function liquidate(address user, uint256 repayAmount) returns (uint256 collateralSeized)",
])

export const ORACLE_ABI = parseAbi([
  "function getPrice(address token) view returns (uint256)",
  "function setPrice(address token, uint256 price)",
  "function owner() view returns (address)",
])

export const ADDR_V2 = {
  weth: "0xb19ac01ca95974bbbefce4e57f8c2f6e3c234360" as Address,
  dai: "0x88e8ba943d04b2de1b1c7e1a2b84e501d90333e1" as Address,
  usdc: "0x335ff97061154bf5372efb8c0b9b57f944279994" as Address,
  usdt: "0xa9ca2f149747ceb21a9ae707cb0a4380dba3ee02" as Address,
  oracle: "0x19ec82b51c672f56fe8c2a775c87a7d1bcaf16bb" as Address,
  market: "0xd0f6a8fddc8b92553896e4525b842b57b266e94e" as Address,
} as const

export type MarketAssetKey = "weth" | "dai" | "usdc" | "usdt"

export const MARKET_ASSETS: {
  key: MarketAssetKey
  symbol: string
  name: string
  icon: string
  decimals: number
}[] = [
  { key: "weth", symbol: "WETH", name: "Wrapped Ether", icon: "ETH", decimals: 18 },
  { key: "dai", symbol: "DAI", name: "Dai Stablecoin", icon: "DAI", decimals: 18 },
  { key: "usdc", symbol: "USDC", name: "USD Coin", icon: "USDC", decimals: 6 },
  { key: "usdt", symbol: "USDT", name: "Tether USD", icon: "USDT", decimals: 6 },
]

export const MARKET_ABI = parseAbi([
  "function configOf(address asset) view returns (uint16 ltvBps, uint16 liqThresholdBps, uint16 liqBonusBps, uint16 reserveFactorBps, uint64 baseRate, uint64 slope1, uint64 slope2, uint64 optimalUtil, uint128 supplyCap, uint128 borrowCap, bool borrowable, bool collateral)",
  "function getReservesList() view returns (address[])",
  "function getReserveData(address asset) view returns (uint256 supplied, uint256 borrowed, uint256 liquidity, uint256 util, uint256 supplyApr, uint256 borrowApr, uint256 price)",
  "function getUserAccountData(address user) view returns (uint256 totalCollateralUsd, uint256 totalDebtUsd, uint256 borrowPowerUsd, uint256 availableBorrowUsd, uint256 hf)",
  "function getUserReserveData(address asset, address user) view returns (uint256 supplyBalance, uint256 debtBalance, bool usingAsCollateral)",
  "function supply(address asset, uint256 amount)",
  "function withdraw(address asset, uint256 amount)",
  "function borrow(address asset, uint256 amount)",
  "function repay(address asset, uint256 amount, address onBehalfOf)",
  "function setUseAsCollateral(address asset, bool enabled)",
  "function liquidate(address user, address debtAsset, address collateralAsset, uint256 repayAmount) returns (uint256)",
])

export const WAD = 10n ** 18n
export const ORACLE_PRECISION = 10n ** 8n
export const WETH_DECIMALS = 18
export const USDC_DECIMALS = 6

export const MAX_UINT = 2n ** 256n - 1n

declare global {
  interface Window {
    ethereum?: any
  }
}
