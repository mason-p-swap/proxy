import type { Coin } from "./types"

export const COINS: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", network: "Bitcoin", icon: "btc", price: 67234.50, minAmount: 0.0003, maxAmount: 5 },
  { symbol: "ETH", name: "Ethereum", network: "ERC-20", icon: "eth", price: 3521.80, minAmount: 0.005, maxAmount: 100 },
  { symbol: "SOL", name: "Solana", network: "Solana", icon: "sol", price: 178.42, minAmount: 0.05, maxAmount: 5000 },
  { symbol: "BNB", name: "BNB", network: "BEP-20", icon: "bnb", price: 612.30, minAmount: 0.01, maxAmount: 500 },
  { symbol: "XRP", name: "XRP", network: "XRP Ledger", icon: "xrp", price: 0.5234, minAmount: 10, maxAmount: 500000 },
  { symbol: "USDT", name: "Tether", network: "TRC-20", icon: "usdt", price: 1.0, minAmount: 10, maxAmount: 100000 },
  { symbol: "USDC", name: "USD Coin", network: "ERC-20", icon: "usdc", price: 1.0, minAmount: 10, maxAmount: 100000 },
  { symbol: "ADA", name: "Cardano", network: "Cardano", icon: "ada", price: 0.4521, minAmount: 20, maxAmount: 500000 },
  { symbol: "DOGE", name: "Dogecoin", network: "Dogecoin", icon: "doge", price: 0.1234, minAmount: 50, maxAmount: 2000000 },
  { symbol: "MATIC", name: "Polygon", network: "Polygon", icon: "matic", price: 0.7123, minAmount: 10, maxAmount: 500000 },
  { symbol: "LINK", name: "Chainlink", network: "ERC-20", icon: "link", price: 14.56, minAmount: 0.5, maxAmount: 20000 },
  { symbol: "AVAX", name: "Avalanche", network: "Avalanche", icon: "avax", price: 27.89, minAmount: 0.1, maxAmount: 10000 },
  { symbol: "LTC", name: "Litecoin", network: "Litecoin", icon: "ltc", price: 84.21, minAmount: 0.01, maxAmount: 5000 },
  { symbol: "ATOM", name: "Cosmos", network: "Cosmos", icon: "atom", price: 8.45, minAmount: 1, maxAmount: 50000 },
  { symbol: "TRX", name: "TRON", network: "TRC-20", icon: "trx", price: 0.1234, minAmount: 50, maxAmount: 2000000 },
  { symbol: "DAI", name: "Dai", network: "ERC-20", icon: "dai", price: 1.0, minAmount: 10, maxAmount: 100000 },
  { symbol: "UNI", name: "Uniswap", network: "ERC-20", icon: "uni", price: 7.89, minAmount: 1, maxAmount: 50000 },
  { symbol: "ARB", name: "Arbitrum", network: "Arbitrum", icon: "arb", price: 1.12, minAmount: 5, maxAmount: 500000 },
]

export const COIN_MAP = Object.fromEntries(COINS.map((c) => [c.symbol, c]))

export const STATS = {
  totalExchanges: 1_284_951,
  totalVolume: "$4.2B",
  avgTime: "~4 min",
  currencies: COINS.length,
}

export const RECENT_EXCHANGES = [
  { from: "BTC", to: "ETH", amount: "0.14 BTC", time: 12 },
  { from: "ETH", to: "SOL", amount: "2.5 ETH", time: 38 },
  { from: "USDT", to: "BTC", amount: "1,200 USDT", time: 61 },
  { from: "SOL", to: "LTC", amount: "18 SOL", time: 90 },
  { from: "DOGE", to: "ETH", amount: "4,800 DOGE", time: 115 },
  { from: "BNB", to: "USDC", amount: "3.2 BNB", time: 143 },
]
