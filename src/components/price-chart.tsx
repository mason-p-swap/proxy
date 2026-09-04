import { useEffect, useMemo, useRef, useState } from "react"
import { fetchOhlc, type Candle, type Timeframe } from "@/lib/chart-data"
import { fmtUsd } from "@/lib/format"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const TFS: Timeframe[] = ["1D", "1W", "1M", "3M"]
const VW = 1000
const VH = 260

type Props = { anchor?: number; coingecko?: string | null; symbol?: string }

export function PriceChart({ anchor, coingecko = "monero", symbol = "zXMR" }: Props) {
  const [tf, setTf] = useState<Timeframe>("1W")
  const [data, setData] = useState<Candle[] | null>(null)
  const [err, setErr] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setErr(false)
    fetchOhlc(tf, coingecko ?? null)
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true))
    return () => { alive = false }
  }, [tf, coingecko])

  const series = useMemo(() => {
    if (!data || data.length < 2) return null
    let candles = data
    const last = data[data.length - 1].c
    if (anchor && anchor > 0 && last > 0) {
      const f = anchor / last
      candles = data.map((c) => ({ t: c.t, o: c.o * f, h: c.h * f, l: c.l * f, c: c.c * f }))
    }
    const lo = Math.min(...candles.map((c) => c.l))
    const hi = Math.max(...candles.map((c) => c.h))
    const span = hi - lo || 1
    const n = candles.length
    const cw = VW / n
    const x = (i: number) => i * cw + cw / 2
    const y = (p: number) => VH - 8 - ((p - lo) / span) * (VH - 16)
    return { candles, lo, hi, n, cw, x, y, first: candles[0].o, last: candles[candles.length - 1].c }
  }, [data, anchor])

  const up = series ? series.last >= series.first : true
  const changePct = series ? ((series.last - series.first) / series.first) * 100 : 0

  const onMove = (e: React.MouseEvent) => {
    if (!series || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover(Math.min(series.n - 1, Math.floor(frac * series.n)))
  }

  const hc = hover != null && series ? series.candles[hover] : null
  const shownPrice = hc ? hc.c : series?.last

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{symbol} / USD</span>
            <span className="rounded-sm bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">live</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {series && shownPrice != null ? fmtUsd(shownPrice) : "—"}
            </span>
            {series && (
              <span className={cn("text-xs font-bold tabular-nums", up ? "text-success" : "text-destructive")}>
                {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
              </span>
            )}
          </div>
          <div className="mt-0.5 h-3 text-[10px] text-muted-foreground">
            {hc
              ? `O ${fmtUsd(hc.o)}  H ${fmtUsd(hc.h)}  L ${fmtUsd(hc.l)}  C ${fmtUsd(hc.c)}`
              : `past ${tf}`}
          </div>
        </div>
        <div className="flex gap-1">
          {TFS.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-bold transition-colors",
                tf === t ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative h-[260px] w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {err ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">chart data unavailable</div>
        ) : !series ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="size-full">
            {series.candles.map((c, i) => {
              const green = c.c >= c.o
              const col = green ? "var(--success)" : "var(--destructive)"
              const bodyTop = series.y(Math.max(c.o, c.c))
              const bodyBot = series.y(Math.min(c.o, c.c))
              const bw = Math.max(1, series.cw * 0.6)
              return (
                <g key={i} opacity={hover == null || hover === i ? 1 : 0.55}>
                  <line
                    x1={series.x(i)} y1={series.y(c.h)} x2={series.x(i)} y2={series.y(c.l)}
                    stroke={col} strokeWidth="1" vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={series.x(i) - bw / 2} y={bodyTop} width={bw} height={Math.max(1, bodyBot - bodyTop)}
                    fill={col}
                  />
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
