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
  | { name: "markets" }
  | { name: "defi" }
  | { name: "dashboard" }
  | { name: "supply" }
  | { name: "borrow" }
  | { name: "docs" }
  | { name: "sim" }
  | { name: "faq" }
  | { name: "how" }
