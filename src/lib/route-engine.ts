import type { Address } from "viem"
import { ADDR_AMM, EXTERNAL_ROUTER, ROUTER_ABI, publicClient, type SwapToken } from "./web3"

export type Venue = "own" | "external"

export type RoutePlan = {
  venue: Venue
  router: Address
  path: Address[]
  viaHub: boolean
}

export type RouteQuote = {
  plan: RoutePlan
  amounts: bigint[]
}

function ownPlan(from: SwapToken, to: SwapToken): RoutePlan {
  const direct = from.symbol === "zXMR" || to.symbol === "zXMR"
  const path: Address[] = direct
    ? [from.address!, to.address!]
    : [from.address!, ADDR_AMM.zxmr, to.address!]
  return { venue: "own", router: ADDR_AMM.router, path, viaHub: !direct }
}

function externalPlan(from: SwapToken, to: SwapToken): RoutePlan {
  return {
    venue: "external",
    router: EXTERNAL_ROUTER,
    path: [from.address!, to.address!],
    viaHub: false,
  }
}

export function planRoutes(from: SwapToken, to: SwapToken): RoutePlan[] {
  if (!from.address || !to.address) return []
  if (from.comingSoon || to.comingSoon) return []
  if (from.address === to.address) return []

  const zxmrInvolved = from.symbol === "zXMR" || to.symbol === "zXMR"
  const nativeInvolved = Boolean(from.isNative || to.isNative)

  if (zxmrInvolved || nativeInvolved) return [ownPlan(from, to)]
  return [externalPlan(from, to), ownPlan(from, to)]
}

export async function quoteBestRoute(
  from: SwapToken,
  to: SwapToken,
  amountIn: bigint
): Promise<RouteQuote | null> {
  for (const plan of planRoutes(from, to)) {
    try {
      const amounts = (await publicClient.readContract({
        address: plan.router,
        abi: ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [amountIn, plan.path],
      })) as bigint[]
      return { plan, amounts }
    } catch {
      continue
    }
  }
  return null
}

export function venueLabel(_plan: RoutePlan): string {
  return "best route"
}
