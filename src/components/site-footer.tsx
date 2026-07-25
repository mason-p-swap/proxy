import { Logo } from "@/components/logo"
import type { Route } from "@/lib/types"
import { SITE_NAME } from "@/lib/site"

type Props = { navigate: (to: Route) => void }

const LINKS: { label: string; route: Route }[] = [
  { label: "Exchange", route: { name: "home" } },
  { label: "DeFi", route: { name: "defi" } },
  { label: "Markets", route: { name: "markets" } },
  { label: "How it works", route: { name: "how" } },
  { label: "FAQ", route: { name: "faq" } },
  { label: "Find order", route: { name: "lookup" } },
]

export function SiteFooter({ navigate }: Props) {
  return (
    <footer className="relative z-10 border-t border-border/40 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5 text-foreground">
            <Logo className="size-4" />
            <span className="font-brand text-sm font-bold tracking-tight">{SITE_NAME}</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {LINKS.map((link) => (
              <button
                key={link.label}
                onClick={() => navigate(link.route)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-7 border-t border-border/30 pt-5 text-[10px] text-muted-foreground/70">
          <span>© 2026 {SITE_NAME}. All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}
