import { useState } from "react"
import { Logo } from "@/components/logo"
import type { Route } from "@/lib/types"
import { SITE_NAME } from "@/lib/site"
import { EXPLORER } from "@/lib/web3"
import { useWallet, connectWallet, switchToSepolia, disconnectWallet, shortAddress } from "@/hooks/use-wallet"
import { Wallet, Loader2, AlertTriangle, ChevronDown, Copy, Check, ExternalLink, LogOut } from "lucide-react"
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

  return <WalletMenu account={account} />
}

function WalletMenu({ account }: { account: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs transition-colors hover:border-foreground/30"
      >
        <span className="size-1.5 rounded-full bg-success" />
        <span className="font-mono font-semibold text-foreground">{shortAddress(account)}</span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
            style={{ animation: "fade-in-up 0.12s ease-out" }}
          >
            <div className="border-b border-border px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected</div>
              <div className="mt-0.5 break-all font-mono text-[11px] text-foreground">{account}</div>
            </div>
            <button
              onClick={copy}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 text-muted-foreground" />}
              {copied ? "Copied" : "Copy address"}
            </button>
            <a
              href={`${EXPLORER}/address/${account}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" />
              View on explorer
            </a>
            <button
              onClick={() => { disconnectWallet(); setOpen(false) }}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-3.5" />
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function TopBar({ route, navigate }: Props) {
  const activeName = route.name

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
