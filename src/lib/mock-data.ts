import type { Coin } from "./types"

export const COINS: Coin[] = [
  { symbol: "ETH", name: "Ethereum", network: "Ethereum", icon: "eth", price: 3521.80, minAmount: 0.005, maxAmount: 100 },
  { symbol: "WETH", name: "Wrapped Ether", network: "ERC-20", icon: "eth", price: 3521.80, minAmount: 0.005, maxAmount: 100 },
  { symbol: "zXMR", name: "Wrapped Monero", network: "ERC-20", icon: "zxmr", price: 282.95, minAmount: 0.05, maxAmount: 1500 },
  { symbol: "XMR", name: "Monero", network: "Monero", icon: "xmr", price: 282.95, minAmount: 0.05, maxAmount: 1500 },
  { symbol: "USDC", name: "USD Coin", network: "ERC-20", icon: "usdc", price: 1.0, minAmount: 10, maxAmount: 100000 },
  { symbol: "USDT", name: "Tether", network: "ERC-20", icon: "usdt", price: 1.0, minAmount: 10, maxAmount: 100000 },
  { symbol: "DAI", name: "Dai", network: "ERC-20", icon: "dai", price: 1.0, minAmount: 10, maxAmount: 100000 },
]

export const COIN_MAP = Object.fromEntries(COINS.map((c) => [c.symbol, c]))

