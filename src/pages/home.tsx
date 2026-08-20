import type { ComponentType } from "react"
import { SwapWidget } from "@/components/swap-widget"
import { CryptoIcon } from "@/components/crypto-icon"
import { Logo } from "@/components/logo"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"
import {
  DepositIllo,
  ConfirmIllo,
  PayoutIllo,
  RateLockIllo,
  CustodyIllo,
  ChainIllo,
  TrackingIllo,
} from "@/components/home-illustrations"
import type { Route } from "@/lib/types"
import { ArrowRight } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

type Props = {
  navigate: (to: Route) => void
}

const SWAP_STEPS: { n: string; title: string; desc: string; Illo: ComponentType }[] = [
  {
    n: "01",
    title: "Connect",
    desc: "Connect your wallet. No account, no sign-up — just approve the connection.",
    Illo: DepositIllo,
  },
  {
    n: "02",
    title: "Confirm",
    desc: "Pick your pair and amount, then confirm the swap in your wallet.",
    Illo: ConfirmIllo,
  },
  {
    n: "03",
    title: "Receive",
    desc: "Tokens land in your wallet the moment the transaction confirms on-chain.",
    Illo: PayoutIllo,
  },
]

const POPULAR_PAIRS: [string, string][] = [
  ["zXMR", "WETH"],
  ["zXMR", "USDC"],
  ["WETH", "USDC"],
  ["USDC", "USDT"],
  ["zXMR", "XMR"],
  ["ETH", "XMR"],
]

const FAQ_TEASER = [
  {
    q: "Do I need an account?",
    a: "No. Connect your wallet and swap — nothing to register, no email, no KYC.",
  },
  {
    q: "How long does a swap take?",
    a: "Swaps settle in a single on-chain transaction — usually a few seconds once it confirms.",
  },
  {
    q: "What are the fees?",
    a: "A flat 0.3% fee per hop, baked into the quote you see. No hidden spread.",
  },
]

function scrollToWidget() {
  document.getElementById("swap-widget")?.scrollIntoView({ behavior: "smooth", block: "center" })
}

export function HomePage({ navigate }: Props) {
  return (
    <div className="relative overflow-hidden pt-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden" aria-hidden>
        <div
          className="absolute left-1/2 top-[300px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-white opacity-[0.09] blur-[130px]"
          style={{ animation: "float-orb-1 20s ease-in-out infinite" }}
        />
        <div
          className="absolute left-[15%] top-[10%] h-[380px] w-[380px] rounded-full bg-white opacity-[0.05] blur-[100px]"
          style={{ animation: "float-orb-2 25s ease-in-out infinite" }}
        />
      </div>

      <section className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 pb-20 pt-12 md:pt-16">
        <div
          className="mb-10 flex flex-col items-center"
          style={{ animation: "fade-in-up 0.6s ease-out" }}
        >
          <div className="flex items-center gap-3 text-foreground">
            <Logo className="size-7 md:size-9" />
            <span className="font-brand text-3xl font-bold tracking-tight md:text-4xl">{SITE_NAME}</span>
          </div>
          <p className="mt-3 max-w-xs text-balance text-center text-xs text-muted-foreground md:max-w-none md:text-sm">
            {SITE_TAGLINE}
          </p>
        </div>

        <div
          id="swap-widget"
          className="relative w-full max-w-md"
          style={{ animation: "fade-in-up 0.6s ease-out 0.15s both" }}
        >
          <SwapWidget />
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-4 py-24">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl">
              How a swap happens
            </h2>
          </div>
          <button
            onClick={() => navigate({ name: "how" })}
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            Read the full breakdown
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {SWAP_STEPS.map((step) => (
            <div
              key={step.n}
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 transition-colors hover:border-foreground/20"
            >
              <step.Illo />
              <div className="border-t border-border/40 p-5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                    {step.n}
                  </span>
                  <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-4 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Popular pairs</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The routes people swap the most, right now.
            </p>
          </div>
          <button
            onClick={() => navigate({ name: "markets" })}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            All markets
            <ArrowRight className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {POPULAR_PAIRS.map(([from, to]) => (
            <button
              key={`${from}-${to}`}
              onClick={scrollToWidget}
              className="group flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 px-4 py-3.5 transition-colors hover:border-foreground/25 hover:bg-white/[0.03]"
            >
              <CryptoIcon symbol={from} size={20} />
              <span className="text-xs font-bold text-foreground">{from}</span>
              <ArrowRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              <span className="text-xs font-bold text-foreground">{to}</span>
              <CryptoIcon symbol={to} size={20} />
            </button>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-y border-border/40 bg-background/40">
        <div className="mx-auto max-w-5xl px-4 py-24">
          <div className="mx-auto mb-12 flex max-w-xl flex-col items-center text-center">
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl">
              Built for people who'd rather not ask permission
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Exchanges keep getting bigger, slower, and nosier. We went the other way: one panel,
              any pair, and your coins never sit in anyone's account — including ours.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {[
              {
                title: "Our own pools",
                desc: "Swaps route through pools we run, so the price you get is live and on-chain.",
                Illo: RateLockIllo,
              },
              {
                title: "Non-custodial",
                desc: "Coins move straight from your wallet through the pool and back. We never hold balances.",
                Illo: CustodyIllo,
              },
              {
                title: "Monero bridge",
                desc: "Swap all the way to native Monero through the ZeroFi bridge. Coming soon.",
                Illo: ChainIllo,
              },
              {
                title: "Low fees",
                desc: "A flat 0.3% fee per hop — the same model the biggest DEXes run on.",
                Illo: TrackingIllo,
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card/40 transition-colors hover:border-foreground/20"
              >
                <f.Illo />
                <div className="border-t border-border/40 p-5">
                  <h3 className="text-sm font-bold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-2xl px-4 py-24">
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Common questions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The three we get asked the most.
          </p>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {FAQ_TEASER.map((item, i) => (
            <AccordionItem
              key={i}
              value={`teaser-${i}`}
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
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate({ name: "faq" })}
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            Read all FAQs
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </section>

      <section className="relative z-10 overflow-hidden">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.045]"
          aria-hidden
        >
          <Logo size={560} />
        </div>
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-32 text-center">
          <h2 className="font-brand text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Ready when you are.
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Pick a pair, connect your wallet, and swap. It settles on-chain in seconds.
          </p>
          <div className="mt-10 flex items-center gap-6">
            <button
              onClick={scrollToWidget}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.04]"
            >
              Start swapping
              <ArrowRight className="size-4" />
            </button>
            <button
              onClick={() => navigate({ name: "how" })}
              className="text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              How it works
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
