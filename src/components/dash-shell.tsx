import { ADDR_V2, EXPLORER } from "@/lib/web3"
import { Logo } from "@/components/logo"
import { SITE_NAME, GITHUB_URL, SUPPORT_EMAIL } from "@/lib/site"
import { connectWallet, switchToSepolia } from "@/hooks/use-wallet"
import type { MoneyMarket } from "@/hooks/use-money-market"
import type { Route } from "@/lib/types"
import {
  ExternalLink, LayoutDashboard, ArrowDownToLine, ArrowUpFromLine,
  Gauge, CircleHelp, Clock, Globe, FileCode2, Mail, Wallet, AlertTriangle, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type DashSection = "dashboard" | "supply" | "borrow" | "docs"

type Props = {
  active: DashSection
  navigate: (to: Route) => void
  children: React.ReactNode
}

export function DashShell({ active, navigate, children }: Props) {
  return (
    <div className="relative min-h-svh overflow-hidden pt-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-white opacity-[0.04] blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl gap-8 px-4 py-8">
        <aside className="sticky top-20 hidden h-fit w-52 shrink-0 lg:block">
          <div className="mb-6 flex items-center gap-2 px-3">
            <Logo className="size-4" />
            <span className="font-brand text-sm font-bold tracking-tight">{SITE_NAME}</span>
            <span className="rounded-full border border-success/50 bg-success/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-success">
              pro
            </span>
          </div>

          <nav className="space-y-0.5">
            <SideItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={active === "dashboard"}
              onClick={() => navigate({ name: "defi" })}
            />
            <SideItem icon={Clock} label="Activity" href={`${EXPLORER}/address/${ADDR_V2.market}?tab=txs`} />
          </nav>

          <SideHeading>explore</SideHeading>
          <nav className="space-y-0.5">
            <SideItem
              icon={ArrowDownToLine}
              label="Supply"
              active={active === "supply"}
              onClick={() => navigate({ name: "supply" })}
            />
            <SideItem
              icon={ArrowUpFromLine}
              label="Borrow"
              active={active === "borrow"}
              onClick={() => navigate({ name: "borrow" })}
            />
            <SideItem icon={Gauge} label="Simulator" onClick={() => navigate({ name: "sim" })} />
          </nav>

          <SideHeading>protocol</SideHeading>
          <nav className="space-y-0.5">
            <SideItem
              icon={Globe}
              label="Protocol"
              href={GITHUB_URL || `${EXPLORER}/address/${ADDR_V2.market}?tab=contract`}
            />
            <SideItem
              icon={FileCode2}
              label="Docs"
              active={active === "docs"}
              onClick={() => navigate({ name: "docs" })}
            />
          </nav>

          <SideHeading>support</SideHeading>
          <nav className="space-y-0.5">
            <SideItem icon={Mail} label="Contact Support" href={`mailto:${SUPPORT_EMAIL}`} />
            <SideItem icon={CircleHelp} label="Help Center" onClick={() => navigate({ name: "faq" })} />
          </nav>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

export function WalletBanner({ mm }: { mm: MoneyMarket }) {
  if (mm.connected) return null
  if (!mm.hasProvider) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <Wallet className="size-4 shrink-0" />
        market data is live from the chain. install MetaMask to supply, borrow, and manage a position.
      </div>
    )
  }
  if (!mm.account) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <span className="text-xs text-muted-foreground">connect your wallet to see and manage your position.</span>
        <button
          onClick={connectWallet}
          disabled={mm.connecting}
          className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-xs font-bold text-background transition-all hover:bg-foreground/90 disabled:opacity-60"
        >
          {mm.connecting ? <Loader2 className="size-3.5 animate-spin" /> : <Wallet className="size-3.5" />}
          {mm.connecting ? "check MetaMask…" : "Connect Wallet"}
        </button>
      </div>
    )
  }
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
      <span className="flex items-center gap-2 text-xs text-warning">
        <AlertTriangle className="size-4" /> wrong network — this market lives on Sepolia.
      </span>
      <button
        onClick={switchToSepolia}
        className="rounded-full bg-foreground px-5 py-2 text-xs font-bold text-background hover:bg-foreground/90"
      >
        Switch to Sepolia
      </button>
    </div>
  )
}

function SideHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

function SideItem({ icon: Icon, label, active, onClick, href }: {
  icon: typeof LayoutDashboard
  label: string
  active?: boolean
  onClick?: () => void
  href?: string
}) {
  const cls = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
    active ? "bg-white/10 font-semibold text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        <Icon className="size-4" />
        {label}
        <ExternalLink className="ml-auto size-3 opacity-50" />
      </a>
    )
  }
  return (
    <button onClick={onClick} className={cls}>
      <Icon className="size-4" />
      {label}
    </button>
  )
}
