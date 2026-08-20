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

export const STATS = {
  totalExchanges: 1_284_951,
  totalVolume: "$4.2B",
  avgTime: "~4 min",
  currencies: COINS.length,
}

export const RECENT_EXCHANGES = [
  { from: "ETH", to: "zXMR", amount: "2.5 ETH", time: 12 },
  { from: "USDC", to: "zXMR", amount: "1,200 USDC", time: 38 },
  { from: "zXMR", to: "USDT", amount: "18 zXMR", time: 61 },
  { from: "WETH", to: "USDC", amount: "0.8 WETH", time: 90 },
  { from: "DAI", to: "zXMR", amount: "4,800 DAI", time: 115 },
  { from: "USDT", to: "DAI", amount: "3,200 USDT", time: 143 },
]
