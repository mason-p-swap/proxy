import { Logo } from "@/components/logo"
import type { Route } from "@/lib/types"
import { SITE_NAME } from "@/lib/site"
import { useWallet, connectWallet, switchToSepolia, shortAddress } from "@/hooks/use-wallet"
import { Wallet, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  route: Route
  navigate: (to: Route) => void
}

const NAV_ITEMS: { label: string; route: Route }[] = [
  { label: "Exchange", route: { name: "home" } },
  { label: "DeFi", route: { name: "defi" } },
  { label: "Markets", route: { name: "markets" } },
  { label: "How it works", route: { name: "how" } },
  { label: "FAQ", route: { name: "faq" } },
]

function WalletButton() {
  const { hasProvider, account, connecting, onSepolia } = useWallet()

  if (!hasProvider) return null

  if (!account) {
    return (
      <button
        onClick={connectWallet}
        disabled={connecting}
        className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-foreground/30 disabled:opacity-60"
      >
        {connecting ? <Loader2 className="size-3.5 animate-spin" /> : <Wallet className="size-3.5" />}
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    )
  }

  if (!onSepolia) {
    return (
      <button
        onClick={switchToSepolia}
        className="flex items-center gap-1.5 rounded-md border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/20"
      >
        <AlertTriangle className="size-3.5" />
        Switch to Sepolia
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs">
      <span className="size-1.5 rounded-full bg-success" />
      <span className="font-mono font-semibold text-foreground">{shortAddress(account)}</span>
    </div>
  )
}

export function TopBar({ route, navigate }: Props) {
  const activeName = route.name === "exchange" ? "home" : route.name

  return (
    <header className="absolute top-0 left-0 right-0 z-40 flex h-14 items-center px-6">
      <button
        onClick={() => navigate({ name: "home" })}
        className="flex items-center gap-2 text-foreground"
      >
        <Logo className="size-4" />
        <span className="font-brand text-sm font-bold tracking-tight">{SITE_NAME}</span>
      </button>

      <nav className="ml-8 hidden items-center gap-1 md:flex">
        {NAV_ITEMS.map((item) => {
          const isActive = activeName === item.route.name
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.route)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="ml-auto">
        <WalletButton />
      </div>
    </header>
  )
}
