import { useEffect, useState } from "react"
import { ADDR_V2, EXPLORER } from "@/lib/web3"
import { Logo } from "@/components/logo"
import { SITE_NAME, GITHUB_URL } from "@/lib/site"
import type { Route } from "@/lib/types"
import { ExternalLink, ChevronLeft, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = { navigate: (to: Route) => void }

type Section = { id: string; label: string }

const SECTIONS: Section[] = [
  { id: "introduction", label: "Introduction" },
  { id: "how-it-works", label: "How it works" },
  { id: "supplying", label: "Supplying" },
  { id: "borrowing", label: "Borrowing" },
  { id: "collateral", label: "Collateral & LTV" },
  { id: "health-factor", label: "Health factor" },
  { id: "liquidations", label: "Liquidations" },
  { id: "interest-rates", label: "Interest rates" },
  { id: "reserves", label: "Reserve parameters" },
  { id: "contracts", label: "Contracts" },
  { id: "disclaimer", label: "Disclaimer" },
]

const RESERVES = [
  { symbol: "WETH", ltv: "80%", threshold: "82.5%", bonus: "5%", reserveFactor: "15%", optimal: "80%", slope1: "3.3%", slope2: "80%" },
  { symbol: "DAI", ltv: "75%", threshold: "78%", bonus: "5%", reserveFactor: "15%", optimal: "90%", slope1: "5.5%", slope2: "75%" },
  { symbol: "USDC", ltv: "75%", threshold: "78%", bonus: "4.5%", reserveFactor: "10%", optimal: "90%", slope1: "5.5%", slope2: "60%" },
  { symbol: "USDT", ltv: "74%", threshold: "76%", bonus: "4.5%", reserveFactor: "20%", optimal: "90%", slope1: "5.5%", slope2: "75%" },
]

const CONTRACTS = [
  { name: "MoneyMarket", addr: ADDR_V2.market },
  { name: "Chainlink oracle", addr: ADDR_V2.oracle },
  { name: "WETH (test)", addr: ADDR_V2.weth },
  { name: "DAI (test)", addr: ADDR_V2.dai },
  { name: "USDC (test)", addr: ADDR_V2.usdc },
  { name: "USDT (test)", addr: ADDR_V2.usdt },
]

export function DocsPage({ navigate }: Props) {
  const [active, setActive] = useState(SECTIONS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          const top = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b))
          setActive(top.target.id)
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="relative min-h-svh overflow-hidden pt-14">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-white opacity-[0.04] blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl gap-10 px-4 py-8">
        <aside className="sticky top-20 hidden h-fit w-52 shrink-0 md:block">
          <button
            onClick={() => navigate({ name: "defi" })}
            className="mb-6 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            back to app
          </button>
          <div className="mb-4 flex items-center gap-2">
            <Logo className="size-4" />
            <span className="font-brand text-sm font-bold tracking-tight">Docs</span>
          </div>
          <nav className="space-y-0.5 border-l border-border/60">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                className={cn(
                  "-ml-px block w-full border-l-2 px-3 py-1.5 text-left text-xs transition-colors",
                  active === s.id
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 max-w-2xl flex-1">
          <div className="mb-10">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{SITE_NAME}</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Money market documentation</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              How the on-chain lending protocol works — supplying, borrowing, collateral,
              interest, and liquidations. Live on the Sepolia testnet.
            </p>
          </div>

          <Doc id="introduction" title="Introduction">
            <p>
              The money market is a set of shared liquidity pools. Anyone can supply a
              supported asset to earn interest, and anyone can borrow against collateral they
              have supplied. There are no accounts and no intermediaries — you interact
              directly with the smart contract from your own wallet.
            </p>
            <p>
              Four assets are currently listed: <B>WETH</B>, <B>DAI</B>, <B>USDC</B>, and{" "}
              <B>USDT</B>. Each can be both supplied and borrowed. Interest rates adjust
              automatically with how much of each pool is being borrowed.
            </p>
            <Callout>
              This is unaudited, educational software running on a test network. The tokens
              are test tokens with no monetary value. Do not use it with real funds.
            </Callout>
          </Doc>

          <Doc id="how-it-works" title="How it works">
            <p>Every supported asset has a reserve — a pool with two sides:</p>
            <ul>
              <li><B>Suppliers</B> deposit the asset and earn the supply APY.</li>
              <li><B>Borrowers</B> take the asset out of the pool and pay the borrow APY.</li>
            </ul>
            <p>
              Interest is tracked with two ever-increasing indexes per reserve — one for
              suppliers, one for borrowers. Your balance is stored as a scaled amount and
              grows automatically as its index grows, so no transaction is needed to collect
              interest. It accrues every block.
            </p>
            <p>
              A share of borrower interest is kept by the protocol as a reserve factor; the
              rest flows to suppliers.
            </p>
          </Doc>

          <Doc id="supplying" title="Supplying">
            <p>
              Supplying deposits an asset into its reserve and starts earning the supply APY
              immediately. Supplied assets also count as collateral by default, which is what
              lets you borrow against them.
            </p>
            <p>
              You can withdraw at any time, as long as your remaining collateral still covers
              any debt you have and the pool has enough free liquidity. Withdrawing the full
              balance clears the position exactly, including interest earned up to that block.
            </p>
          </Doc>

          <Doc id="borrowing" title="Borrowing">
            <p>
              Once you have supplied collateral, you can borrow any listed asset up to your
              borrow power. Borrow power is the sum of each collateral&apos;s value multiplied
              by its loan-to-value (LTV). Borrowing is cross-asset: you can supply WETH and
              borrow USDC against it, for example.
            </p>
            <p>
              You pay the borrow APY on what you owe, and can repay any amount at any time.
              Repaying the full balance uses a clear-everything mode so interest accrued up to
              the moment the transaction lands is included and no dust is left behind.
            </p>
          </Doc>

          <Doc id="collateral" title="Collateral & LTV">
            <p>
              <B>Loan-to-value (LTV)</B> is the most you can borrow against an asset — at 80%
              LTV, $1,000 of collateral grants $800 of borrow power.
            </p>
            <p>
              Each supplied reserve can be toggled on or off as collateral. Turning a reserve
              off means it still earns yield but no longer backs any borrowing — useful if you
              want to isolate which assets secure your loans. You cannot disable collateral if
              doing so would make your position unsafe.
            </p>
          </Doc>

          <Doc id="health-factor" title="Health factor">
            <p>
              The health factor is a single number summarising how safe a position is across
              everything you have supplied and borrowed:
            </p>
            <Formula>health factor = (Σ collateral × liquidation threshold) ÷ total debt</Formula>
            <ul>
              <li>Above 1.0 — the position is safe.</li>
              <li>Exactly 1.0 — at the liquidation line.</li>
              <li>Below 1.0 — the position can be liquidated.</li>
            </ul>
            <p>
              It rises when you add collateral or repay debt, and falls when your collateral
              loses value or your debt grows with interest. With no debt, the health factor is
              effectively infinite.
            </p>
          </Doc>

          <Doc id="liquidations" title="Liquidations">
            <p>
              If a position&apos;s health factor drops below 1.0, anyone can liquidate it: they
              repay part of the debt and receive an equivalent value of the borrower&apos;s
              collateral, plus a bonus. That bonus is the incentive that keeps the protocol
              solvent without any central operator.
            </p>
            <p>
              A single liquidation can repay at most 50% of the position&apos;s debt (the close
              factor), and the seized collateral is priced at the oracle rate plus that
              reserve&apos;s liquidation bonus. Keeping your health factor comfortably above 1
              is how you avoid being liquidated.
            </p>
          </Doc>

          <Doc id="interest-rates" title="Interest rates">
            <p>
              Each reserve uses a two-slope interest model based on utilization — the share of
              supplied assets currently borrowed:
            </p>
            <ul>
              <li>Below the optimal utilization, the rate climbs gently along the first slope.</li>
              <li>Above it, the rate climbs steeply along the second slope, encouraging repayment and fresh supply so the pool never fully empties.</li>
            </ul>
            <p>
              The supply APY is the borrow APY scaled by utilization, minus the reserve factor —
              so suppliers earn only on the portion actually lent out.
            </p>
          </Doc>

          <Doc id="reserves" title="Reserve parameters">
            <p>Current risk and rate parameters per listed asset:</p>
            <div className="my-4 overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Asset</th>
                    <th className="px-3 py-2.5 font-medium">LTV</th>
                    <th className="px-3 py-2.5 font-medium">Liq. threshold</th>
                    <th className="px-3 py-2.5 font-medium">Liq. bonus</th>
                    <th className="px-3 py-2.5 font-medium">Reserve factor</th>
                    <th className="px-3 py-2.5 font-medium">Optimal U</th>
                  </tr>
                </thead>
                <tbody>
                  {RESERVES.map((r) => (
                    <tr key={r.symbol} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2.5 font-bold text-foreground">{r.symbol}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.ltv}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.threshold}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.bonus}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.reserveFactor}</td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.optimal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              The close factor is 50% for every reserve. Parameters are owner-configurable
              on-chain.
            </p>
          </Doc>

          <Doc id="contracts" title="Contracts">
            <p>
              All contracts are deployed and source-verified on the Sepolia testnet. The
              explorer&apos;s read and write tabs let you inspect state and call functions
              directly.
            </p>
            <div className="my-4 space-y-2">
              {CONTRACTS.map((c) => (
                <ContractRow key={c.addr} name={c.name} addr={c.addr} />
              ))}
            </div>
            {GITHUB_URL && (
              <p>
                Source code:{" "}
                <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-foreground underline">
                  {GITHUB_URL.replace("https://", "")}
                  <ExternalLink className="size-3" />
                </a>
              </p>
            )}
          </Doc>

          <Doc id="disclaimer" title="Disclaimer">
            <p>
              This protocol is unaudited, educational software deployed to a public test
              network. The listed tokens are test tokens with no monetary value and open
              faucets. Never deploy this code to a live network or use it with real funds.
            </p>
            <p>
              Prices come from decentralized Chainlink data feeds, with stablecoins pegged to
              $1. On this test deployment the oracle also supports a manual override so price
              movements and liquidations can be demonstrated; that override would not exist in a
              production deployment.
            </p>
          </Doc>
        </div>
      </div>
    </div>
  )
}

function Doc({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-20">
      <h2 className="mb-3 text-xl font-bold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-warning/40 bg-warning/5 p-4 text-xs leading-relaxed text-muted-foreground">
      {children}
    </div>
  )
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-lg border border-border/60 bg-background/40 px-4 py-3 font-mono text-xs text-foreground">
      {children}
    </div>
  )
}

function ContractRow({ name, addr }: { name: string; addr: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(addr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
      <span className="w-28 shrink-0 text-xs font-bold text-foreground">{name}</span>
      <span className="min-w-0 flex-1 break-all font-mono text-[11px] text-muted-foreground">{addr}</span>
      <button onClick={copy} className="text-muted-foreground transition-colors hover:text-foreground" title="copy address">
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
      <a
        href={`${EXPLORER}/address/${addr}`}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground transition-colors hover:text-foreground"
        title="view on explorer"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  )
}
