import { MarketDashboard } from "@/components/market-dashboard"
import type { Route } from "@/lib/types"
import { ShieldCheck, Gauge, Landmark, Scale } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const EDUCATION = [
  {
    q: "Which assets can I use?",
    a: "The markets above list every supported asset — currently WETH, DAI, USDC, and USDT. You can supply any of them to earn yield, and use them as collateral to borrow another. More assets will be added over time.",
  },
  {
    q: "How does lending work?",
    a: "When you supply an asset, it joins a shared pool that borrowers draw from. Borrowers pay interest to the pool, and that interest streams to suppliers — that's the Supply APY you see. You can withdraw your assets (plus earned interest) whenever the pool has liquidity.",
  },
  {
    q: "How does borrowing work?",
    a: "First you supply an asset as collateral. Then you can borrow a different asset against it — up to a limit set by the collateral's loan-to-value. You pay the Borrow APY on what you owe, and you can repay at any time to unlock your collateral.",
  },
  {
    q: "What is collateral?",
    a: "Collateral is the asset you lock up to guarantee your loan. If you never repay, the protocol can sell your collateral to cover the debt. Because crypto prices move, you can only borrow a fraction of your collateral's value — e.g. 80% for WETH, 75% for DAI.",
  },
  {
    q: "What is the health factor?",
    a: "One number that summarizes how safe your loan is, across everything you've supplied and borrowed. Above 2: comfortable. Between 1 and 1.2: risky. Below 1: your position can be liquidated. It rises when you add collateral or repay debt, and falls when your collateral loses value or your debt grows.",
  },
  {
    q: "What is liquidation?",
    a: "If your health factor drops below 1, anyone can repay up to half your debt and take a matching slice of your collateral plus a bonus (5% on WETH here). That bonus is why liquidators exist. Keeping your health factor comfortably above 1 is how you avoid them.",
  },
]

export function DefiPage({ navigate }: { navigate: (to: Route) => void }) {
  return (
    <div className="relative min-h-svh overflow-hidden pt-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-white opacity-[0.04] blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10" style={{ animation: "fade-in-up 0.5s ease-out" }}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">DeFi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Supply crypto to earn yield, or borrow against it as collateral. No account —
            just your wallet. Live on Sepolia.
          </p>
        </div>

        <MarketDashboard navigate={navigate} />

        <div className="mb-12">
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight text-foreground">New to lending?</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The whole system in six short answers.
            </p>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Landmark,
                title: "Supply → earn",
                desc: "Your assets join a pool. Borrowers pay interest into it, and that interest streams to you.",
              },
              {
                icon: Scale,
                title: "Collateral → borrow",
                desc: "Lock WETH (or any supported asset) as collateral and borrow another asset against it.",
              },
              {
                icon: Gauge,
                title: "Health factor",
                desc: "One number for loan safety. Keep it above 1 and your collateral stays yours.",
              },
            ].map((c) => {
              const Icon = c.icon
              return (
                <div key={c.title} className="rounded-xl border border-border/60 bg-card/40 p-5">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-foreground">
                    <Icon className="size-4" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-foreground">{c.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
                </div>
              )
            })}
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {EDUCATION.map((item, i) => (
              <AccordionItem
                key={i}
                value={`edu-${i}`}
                className="rounded-xl border border-border/60 bg-card/40 px-4"
              >
                <AccordionTrigger className="py-4 text-left text-sm font-bold text-foreground hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            These markets run on real, unaudited smart contracts on the Sepolia testnet — the
            assets are test tokens with no monetary value. On a real network, supplied assets
            carry smart-contract and liquidation risk. Never borrow more than you can
            comfortably repay.
          </p>
        </div>
      </div>
    </div>
  )
}
