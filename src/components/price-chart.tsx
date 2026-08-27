import { useEffect, useMemo, useRef, useState } from "react"
import { fetchPriceHistory, type Candle, type Timeframe } from "@/lib/chart-data"
import { fmtUsd } from "@/lib/format"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const TFS: Timeframe[] = ["1D", "1W", "1M", "3M"]
const VW = 1000
const VH = 260

type Props = { anchor?: number }

export function PriceChart({ anchor }: Props) {
  const [tf, setTf] = useState<Timeframe>("1W")
  const [data, setData] = useState<Candle[] | null>(null)
  const [err, setErr] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setErr(false)
    fetchPriceHistory(tf)
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true))
    return () => { alive = false }
  }, [tf])

  const series = useMemo(() => {
    if (!data || data.length < 2) return null
    let pts = data.map((c) => c.p)
    const last = pts[pts.length - 1]
    if (anchor && anchor > 0 && last > 0) {
      const factor = anchor / last
      pts = pts.map((p) => p * factor)
    }
    const min = Math.min(...pts)
    const max = Math.max(...pts)
    const span = max - min || 1
    const n = pts.length
    const x = (i: number) => (i / (n - 1)) * VW
    const y = (p: number) => VH - 8 - ((p - min) / span) * (VH - 16)
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${y(p).toFixed(2)}`).join(" ")
    const area = `${line} L${VW} ${VH} L0 ${VH} Z`
    return { pts, min, max, n, x, y, line, area, first: pts[0], last: pts[pts.length - 1] }
  }, [data, anchor])

  const up = series ? series.last >= series.first : true
  const changePct = series ? ((series.last - series.first) / series.first) * 100 : 0
  const color = up ? "var(--success)" : "var(--destructive)"

  const onMove = (e: React.MouseEvent) => {
    if (!series || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover(Math.round(frac * (series.n - 1)))
  }

  const hoverCandle = hover != null && data ? data[hover] : null
  const hoverPrice = series && hover != null ? series.pts[hover] : null

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">zXMR / USD</span>
            <span className="rounded-sm bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              live
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {series ? fmtUsd(hoverPrice ?? series.last) : "—"}
            </span>
            {series && (
              <span className={cn("text-xs font-bold tabular-nums", up ? "text-success" : "text-destructive")}>
                {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
              </span>
            )}
          </div>
          <div className="mt-0.5 h-3 text-[10px] text-muted-foreground">
            {hoverCandle ? new Date(hoverCandle.t).toLocaleString() : `past ${tf}`}
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

      <div
        ref={wrapRef}
        className="relative h-[260px] w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {err ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            chart data unavailable
          </div>
        ) : !series ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            preserveAspectRatio="none"
            className="size-full overflow-visible"
          >
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={series.area} fill="url(#chartFill)" />
            <path
              d={series.line}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            {hover != null && (
              <>
                <line
                  x1={series.x(hover)}
                  y1="0"
                  x2={series.x(hover)}
                  y2={VH}
                  stroke="var(--foreground)"
                  strokeOpacity="0.25"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={series.x(hover)}
                  cy={series.y(series.pts[hover])}
                  r="3.5"
                  fill={color}
                  stroke="var(--background)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  )
}
