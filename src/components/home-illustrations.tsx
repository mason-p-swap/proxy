import type { ReactNode, CSSProperties } from "react"
import { CryptoIcon } from "@/components/crypto-icon"
import { Wallet, ArrowRightLeft, Lock, Route, Search } from "lucide-react"

const LINE_STROKE = "oklch(1 0 0 / 0.16)"

function Node({
  x,
  y,
  label,
  children,
}: {
  x: string
  y: string
  label?: string
  children: ReactNode
}) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
      style={{ left: x, top: y }}
    >
      <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/90 text-foreground shadow-[0_4px_16px_oklch(0_0_0/0.5)]">
        {children}
      </div>
      {label && (
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      )}
    </div>
  )
}

function CoinNode({ x, y, symbol }: { x: string; y: string; symbol: string }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-background/90 p-1 shadow-[0_4px_16px_oklch(0_0_0/0.5)]"
      style={{ left: x, top: y }}
    >
      <CryptoIcon symbol={symbol} size={22} />
    </div>
  )
}

function Chip({
  children,
  className = "",
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/60 bg-background/90 px-2.5 py-1 text-[10px] text-muted-foreground shadow-[0_4px_16px_oklch(0_0_0/0.5)] ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

function Lines({ lines }: { lines: [string, string, string, string][] }) {
  return (
    <svg className="absolute inset-0 size-full" aria-hidden>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={LINE_STROKE}
          strokeWidth="1"
          className="dash-line"
        />
      ))}
    </svg>
  )
}

export function DepositIllo() {
  return (
    <div className="dot-grid relative h-40" aria-hidden>
      <Lines
        lines={[
          ["22%", "24%", "50%", "58%"],
          ["50%", "20%", "50%", "58%"],
          ["78%", "24%", "50%", "58%"],
        ]}
      />
      <CoinNode x="22%" y="24%" symbol="zXMR" />
      <CoinNode x="50%" y="20%" symbol="ETH" />
      <CoinNode x="78%" y="24%" symbol="XMR" />
      <Node x="50%" y="58%">
        <Wallet className="size-4" />
      </Node>
      <Chip className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <span className="size-1.5 animate-pulse rounded-full bg-warning" />
        awaiting deposit
      </Chip>
    </div>
  )
}

export function ConfirmIllo() {
  return (
    <div className="dot-grid relative h-40" aria-hidden>
      <Lines
        lines={[
          ["20%", "28%", "50%", "48%"],
          ["80%", "30%", "50%", "48%"],
          ["26%", "74%", "50%", "48%"],
        ]}
      />
      <CoinNode x="20%" y="28%" symbol="zXMR" />
      <CoinNode x="80%" y="30%" symbol="ETH" />
      <CoinNode x="26%" y="74%" symbol="USDT" />
      <Node x="50%" y="48%">
        <div className="size-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </Node>
      <Chip className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <span className="size-1.5 animate-pulse rounded-full bg-warning" />
        confirmations · 4/6
      </Chip>
    </div>
  )
}

export function PayoutIllo() {
  return (
    <div className="dot-grid relative h-40" aria-hidden>
      <Lines lines={[["25%", "45%", "75%", "45%"]]} />
      <div
        className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
        style={{ top: "45%", animation: "payout-dot 2.2s ease-in-out infinite" }}
      />
      <Node x="25%" y="45%" label="swap">
        <ArrowRightLeft className="size-4" />
      </Node>
      <Node x="75%" y="45%" label="you">
        <Wallet className="size-4" />
      </Node>
      <Chip className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <span className="size-1.5 rounded-full bg-success" />
        order complete
      </Chip>
    </div>
  )
}

export function RateLockIllo() {
  return (
    <div className="dot-grid relative flex h-40 flex-col items-center justify-center gap-3.5 px-6" aria-hidden>
      <Chip className="px-3 py-1.5 text-[11px] text-foreground">
        <Lock className="size-3 text-muted-foreground" />
        1 ETH = 12.4470 zXMR
      </Chip>
      <div className="h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-foreground"
          style={{ animation: "rate-drain 30s linear infinite" }}
        />
      </div>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
        rate holds for 30:00
      </span>
    </div>
  )
}

export function CustodyIllo() {
  return (
    <div className="dot-grid relative h-40" aria-hidden>
      <Lines
        lines={[
          ["18%", "42%", "50%", "42%"],
          ["50%", "42%", "82%", "42%"],
        ]}
      />
      <Node x="18%" y="42%" label="you">
        <Wallet className="size-4" />
      </Node>
      <Node x="50%" y="42%" label="swap">
        <ArrowRightLeft className="size-4" />
      </Node>
      <Node x="82%" y="42%" label="you">
        <Wallet className="size-4" />
      </Node>
      <Chip className="absolute bottom-3 left-1/2 -translate-x-1/2">balances held · 0</Chip>
    </div>
  )
}

export function ChainIllo() {
  return (
    <div className="dot-grid relative h-40" aria-hidden>
      <Lines
        lines={[
          ["20%", "22%", "50%", "46%"],
          ["80%", "22%", "50%", "46%"],
          ["20%", "74%", "50%", "46%"],
          ["80%", "74%", "50%", "46%"],
        ]}
      />
      <CoinNode x="20%" y="22%" symbol="ETH" />
      <CoinNode x="80%" y="22%" symbol="XMR" />
      <CoinNode x="20%" y="74%" symbol="USDC" />
      <CoinNode x="80%" y="74%" symbol="zXMR" />
      <Node x="50%" y="46%">
        <Route className="size-4" />
      </Node>
      <Chip className="absolute bottom-3 left-1/2 -translate-x-1/2">ethereum ⇄ monero</Chip>
    </div>
  )
}

export function TrackingIllo() {
  return (
    <div className="dot-grid relative flex h-40 flex-col items-center justify-center gap-4 px-6" aria-hidden>
      <Chip className="px-3 py-1.5 text-[11px] text-foreground">
        <Search className="size-3 text-muted-foreground" />
        order 7F2K-9QLX
      </Chip>
      <div className="flex w-full max-w-[190px] items-center">
        <span className="size-2 shrink-0 rounded-full bg-success" />
        <span className="h-px flex-1 bg-success/50" />
        <span className="size-2 shrink-0 rounded-full bg-success" />
        <span className="h-px flex-1 border-t border-dashed border-border" />
        <span className="size-2 shrink-0 animate-pulse rounded-full border border-foreground/60 bg-background" />
      </div>
      <div className="flex w-full max-w-[210px] justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
        <span>deposit</span>
        <span>exchange</span>
        <span>payout</span>
      </div>
    </div>
  )
}
