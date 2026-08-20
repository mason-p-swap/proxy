import { useEffect, useState, useCallback } from "react"
import type { Route } from "./types"

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "")
  const parts = clean.split("/").filter(Boolean)

  if (parts.length === 0) return { name: "home" }
  if (parts[0] === "markets") return { name: "markets" }
  if (parts[0] === "defi") return { name: "defi" }
  if (parts[0] === "dashboard") return { name: "dashboard" }
  if (parts[0] === "supply") return { name: "supply" }

  if (parts[0] === "deposit") return { name: "supply" }
  if (parts[0] === "borrow") return { name: "borrow" }
  if (parts[0] === "docs") return { name: "docs" }
  if (parts[0] === "sim") return { name: "sim" }
  if (parts[0] === "faq") return { name: "faq" }
  if (parts[0] === "how") return { name: "how" }
  return { name: "home" }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case "home": return "#/"
    case "markets": return "#/markets"
    case "defi": return "#/defi"
    case "dashboard": return "#/dashboard"
    case "supply": return "#/supply"
    case "borrow": return "#/borrow"
    case "docs": return "#/docs"
    case "sim": return "#/sim"
    case "faq": return "#/faq"
    case "how": return "#/how"
  }
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash))
    window.addEventListener("hashchange", handler)
    return () => window.removeEventListener("hashchange", handler)
  }, [])

  const navigate = useCallback((to: Route) => {
    window.location.hash = routeToHash(to)
  }, [])

  return { route, navigate }
}
