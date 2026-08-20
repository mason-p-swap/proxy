import type { Address } from "viem"
import { ADDR_AMM, UNISWAP_V2_ROUTER, ROUTER_ABI, publicClient, type SwapToken } from "./web3"

export type Venue = "zerofi" | "uniswap"

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

function zerofiPlan(from: SwapToken, to: SwapToken): RoutePlan {
  const direct = from.symbol === "zXMR" || to.symbol === "zXMR"
  const path: Address[] = direct
    ? [from.address!, to.address!]
    : [from.address!, ADDR_AMM.zxmr, to.address!]
  return { venue: "zerofi", router: ADDR_AMM.router, path, viaHub: !direct }
}

function uniswapPlan(from: SwapToken, to: SwapToken): RoutePlan {
  return {
    venue: "uniswap",
    router: UNISWAP_V2_ROUTER,
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

  if (zxmrInvolved || nativeInvolved) return [zerofiPlan(from, to)]
  return [uniswapPlan(from, to), zerofiPlan(from, to)]
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

export function venueLabel(plan: RoutePlan): string {
  if (plan.venue === "uniswap") return "via Uniswap"
  return plan.viaHub ? "via ZeroFi pool · zXMR hub" : "via ZeroFi pool"
}
