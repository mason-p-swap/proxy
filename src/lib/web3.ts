import { createPublicClient, createWalletClient, custom, http, parseAbi, type Address } from "viem"
import { sepolia } from "viem/chains"

export const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"
export const SEPOLIA_CHAIN_ID = sepolia.id

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
  zxmr: "0xab79db732c51c398f7dddecd2cb4f7d9464e513a" as Address,
  oracle: "0x7bcea81573c4ce0e6b3c0ec1db8397219f24fe18" as Address,
  market: "0xd0f6a8fddc8b92553896e4525b842b57b266e94e" as Address,
} as const

export type MarketAssetKey = "weth" | "dai" | "usdc" | "usdt" | "zxmr"

export const MARKET_ASSETS: {
  key: MarketAssetKey
  symbol: string
  name: string
  icon: string
  decimals: number
}[] = [
  { key: "zxmr", symbol: "zXMR", name: "Wrapped Monero", icon: "zXMR", decimals: 18 },
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

export const ADDR_AMM = {
  zxmr: "0xab79db732c51c398f7dddecd2cb4f7d9464e513a" as Address,
  factory: "0x9990d69a11cecf01b78d829ab4611d7405e08636" as Address,
  router: "0x24ec2cfc4101787259ef2b4fd0400f6a25a01da6" as Address,
  weth: "0x69cc6024c1d687997a95635f782eee1f5206e8bb" as Address,
} as const

export const UNISWAP_V2_ROUTER = "0xee567fe1712faf6149d80da1e6934e354124cfe3" as Address

export type SwapToken = {
  symbol: string
  name: string
  icon: string
  decimals: number
  address?: Address
  hasFaucet?: boolean
  comingSoon?: boolean
  isNative?: boolean
}

export const SWAP_TOKENS: SwapToken[] = [
  { symbol: "ETH", name: "Ethereum", icon: "ETH", decimals: 18, address: ADDR_AMM.weth, isNative: true },
  { symbol: "WETH", name: "Wrapped Ether", icon: "ETH", decimals: 18, address: ADDR_AMM.weth },
  { symbol: "zXMR", name: "Wrapped Monero", icon: "zXMR", decimals: 18, address: ADDR_AMM.zxmr, hasFaucet: true },
  { symbol: "USDC", name: "USD Coin", icon: "USDC", decimals: 6, address: ADDR_V2.usdc, hasFaucet: true },
  { symbol: "USDT", name: "Tether USD", icon: "USDT", decimals: 6, address: ADDR_V2.usdt, hasFaucet: true },
  { symbol: "DAI", name: "Dai Stablecoin", icon: "DAI", decimals: 18, address: ADDR_V2.dai, hasFaucet: true },
  { symbol: "XMR", name: "Monero", icon: "XMR", decimals: 12, comingSoon: true },
]

export const ROUTER_ABI = parseAbi([
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
])

export const WAD = 10n ** 18n

export const MAX_UINT = 2n ** 256n - 1n

declare global {
  interface Window {
    ethereum?: any
  }
}
