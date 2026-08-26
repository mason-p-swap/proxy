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
        a: "No. Connect your wallet and swap. There's no sign-up, no email, and no KYC — you interact directly with the smart contracts from your own wallet.",
      },
      {
        q: "How long does a swap take?",
        a: "A swap is a single on-chain transaction — usually a few seconds once it confirms. There's no deposit to send, no third party to wait on, and no order to track.",
      },
      {
        q: "Which tokens are supported?",
        a: "zXMR, ETH, WETH, USDC, USDT, and DAI. Native Monero (XMR) is coming once the bridge ships. See the Markets page for the full list.",
      },
    ],
  },
  {
    category: "Rates & fees",
    items: [
      {
        q: "How is the price set?",
        a: "Prices come from live on-chain liquidity — either our own zXMR pools or Uniswap, whichever the router finds cheaper for your pair. You see the exact quote before you confirm.",
      },
      {
        q: "What are the fees?",
        a: "A flat 0.3% fee per hop, already baked into the quote — the same model major DEXes use. You also pay the network's gas fee to submit the transaction.",
      },
      {
        q: "Is there slippage?",
        a: "Yes — like any AMM, the price moves as pools trade. Every swap includes a minimum-output guard, so it reverts rather than filling at a worse price than you accepted.",
      },
    ],
  },
  {
    category: "Security & custody",
    items: [
      {
        q: "Do you hold my funds?",
        a: "Never. Swaps are non-custodial and atomic: your coins move from your wallet, through the pool, and back in one transaction. There's no deposit address and nothing we could hold.",
      },
      {
        q: "Can I see my past swaps?",
        a: "Yes — every swap is a normal blockchain transaction. The confirmation links straight to the block explorer, where the swap is permanently recorded.",
      },
      {
        q: "What happens if a swap fails?",
        a: "It simply reverts and you keep your coins (you only lose the gas for the failed transaction). Because swaps are atomic, there's no half-completed state — either it fills or nothing happens.",
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
