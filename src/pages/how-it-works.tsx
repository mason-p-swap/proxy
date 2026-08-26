import { ArrowRight, Wallet, Coins, Loader, CheckCircle2 } from "lucide-react"
import type { Route } from "@/lib/types"

const STEPS = [
  {
    n: 1,
    icon: Wallet,
    title: "Connect your wallet",
    desc: "Connect MetaMask. No account, no sign-up, no email — and you keep custody of your coins the entire time.",
  },
  {
    n: 2,
    icon: Coins,
    title: "Pick your pair and amount",
    desc: "Choose what you're swapping and how much. You'll see a live quote with the price and the 0.3% fee before you commit to anything.",
  },
  {
    n: 3,
    icon: Loader,
    title: "Confirm the swap",
    desc: "Approve the transaction in your wallet. The router automatically finds the best-priced liquidity for your pair and settles it on-chain.",
  },
  {
    n: 4,
    icon: CheckCircle2,
    title: "Receive on-chain",
    desc: "The swap settles in a single transaction, usually in seconds. Tokens land straight in your wallet; nothing is ever held for you.",
  },
]

const FEATURES = [
  { title: "No account", desc: "Swap instantly. No sign-up, no KYC, no email." },
  { title: "Non-custodial", desc: "Coins go from your wallet, through the pool, and back. We never hold them." },
  { title: "Smart routing", desc: "Each swap is auto-routed to the best available on-chain price." },
  { title: "On-chain & verifiable", desc: "Every swap is a single transaction you can verify on the block explorer." },
]

type Props = { navigate: (to: Route) => void }

export function HowItWorksPage({ navigate }: Props) {
  return (
    <div className="relative min-h-svh overflow-hidden pt-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-white opacity-[0.05] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-12" style={{ animation: "fade-in-up 0.5s ease-out" }}>
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">How it works</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Four steps. No account. Wallet to wallet in one on-chain transaction.
          </p>
        </div>

        <div className="relative mb-16">
          <div className="absolute left-[27px] top-12 bottom-12 w-px bg-gradient-to-b from-foreground/20 via-foreground/10 to-transparent" aria-hidden />

          <div className="space-y-8">
            {STEPS.map((step) => {
              const Icon = step.icon
              return (
                <div
                  key={step.n}
                  className="relative flex gap-5"
                  style={{ animation: `fade-in-up 0.5s ease-out ${step.n * 0.1}s both` }}
                >
                  <div className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-foreground">
                    <Icon className="size-5" />
                  </div>

                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Step {step.n}
                      </span>
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Swap fee", value: "0.3%" },
            { label: "Settles in", value: "1 tx" },
            { label: "Custody", value: "Yours" },
            { label: "Network", value: "Sepolia" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/60 bg-card/40 p-4 text-center"
            >
              <div className="text-xl font-bold tabular-nums text-foreground">{s.value}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-12">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Why use us
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border/60 bg-card/40 p-5">
                <h3 className="text-sm font-bold text-foreground">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
          <h2 className="text-lg font-bold text-foreground">Ready to swap?</h2>
          <p className="max-w-sm text-xs text-muted-foreground">
            Connect your wallet and swap. No account required.
          </p>
          <button
            onClick={() => navigate({ name: "home" })}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start swapping
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
