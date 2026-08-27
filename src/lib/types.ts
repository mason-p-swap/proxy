export type Coin = {
  symbol: string
  name: string
  network: string
  icon: string
  price: number
  minAmount: number
  maxAmount: number
}

export type Route =
  | { name: "home" }
  | { name: "trade" }
  | { name: "markets" }
  | { name: "defi" }
  | { name: "supply" }
  | { name: "borrow" }
  | { name: "docs" }
  | { name: "sim" }
  | { name: "faq" }
  | { name: "how" }
