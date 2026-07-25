import { ArrowRight, HelpCircle } from "lucide-react"
import type { Route } from "@/lib/types"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const FAQ_SECTIONS = [
  {
    category: "Getting started",
    items: [
      {
        q: "Do I need to create an account?",
        a: "No. Every exchange is fully anonymous. You don't need to register, verify your identity, or provide an email. Just pick your coins, enter your destination address, and send.",
      },
      {
        q: "How long does an exchange take?",
        a: "Most swaps complete in under 4 minutes. The exact time depends on the networks involved and their block confirmation times. Bitcoin deposits typically take longer than Solana or Ethereum.",
      },
      {
        q: "Which coins are supported?",
        a: "We support 20 cryptocurrencies across 8 networks including Bitcoin, Ethereum, Solana, BNB Chain, Tron, Polygon, Avalanche, and more. Check the Markets page for the full list.",
      },
    ],
  },
  {
    category: "Rates & fees",
    items: [
      {
        q: "What's the difference between float and fixed rates?",
        a: "A float rate updates with the market until your deposit is confirmed. A fixed rate is locked for 30 minutes, protecting you from volatility. Fixed rates include a small fee (0.5%) for the guarantee.",
      },
      {
        q: "How are fees calculated?",
        a: "Our fee is already included in the displayed rate. There are no hidden charges. The amount you see is what you receive, minus the standard network fee for your destination address.",
      },
      {
        q: "Is there a minimum or maximum amount?",
        a: "Yes, each coin has its own limits based on network fees and liquidity. Minimums start as low as $5. You'll see the limits for your chosen pair on the exchange panel.",
      },
    ],
  },
  {
    category: "Security & tracking",
    items: [
      {
        q: "Do you store my funds?",
        a: "No. We are non-custodial. Your deposit goes directly to a unique per-swap address, is exchanged immediately upon confirmation, and routed to your wallet. We never hold balances.",
      },
      {
        q: "How do I track my exchange?",
        a: "After creating an exchange you receive a unique order ID. Use the 'Find order' button in the top bar to check the status at any time. You can also bookmark the exchange page directly.",
      },
      {
        q: "What if I send the wrong amount or coin?",
        a: "Send the exact amount shown on your exchange page. If you send less, the swap may not complete. If you send the wrong coin to a deposit address, contact support immediately with your order ID — recovery may be possible but is not guaranteed.",
      },
    ],
  },
]

type Props = { navigate: (to: Route) => void }

export function FaqPage({ navigate }: Props) {
  return (
    <div className="relative min-h-svh overflow-hidden pt-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-white opacity-[0.04] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-12" style={{ animation: "fade-in-up 0.5s ease-out" }}>
        <div className="mb-10 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full border border-border/60 bg-card/40">
            <HelpCircle className="size-5 text-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Frequently asked questions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything you need to know about swapping with us.
          </p>
        </div>

        <div className="space-y-10">
          {FAQ_SECTIONS.map((section) => (
            <div key={section.category}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {section.category}
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {section.items.map((item, i) => (
                  <AccordionItem
                    key={i}
                    value={`${section.category}-${i}`}
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
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
          <h2 className="text-lg font-bold text-foreground">Still have questions?</h2>
          <p className="max-w-sm text-xs text-muted-foreground">
            Try the exchange — it takes less than a minute to start.
          </p>
          <button
            onClick={() => navigate({ name: "home" })}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start exchanging
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
