export function fmtUsd(
  value: number,
  opts: { compact?: boolean; decimals?: number } = {}
): string {
  const { compact = false, decimals } = opts
  if (value === 0) return "$0.00"
  const abs = Math.abs(value)

  if (compact) {
    if (abs >= 1e9)
      return `$${(value / 1e9).toFixed(2)}B`
    if (abs >= 1e6)
      return `$${(value / 1e6).toFixed(2)}M`
    if (abs >= 1e3)
      return `$${(value / 1e3).toFixed(2)}K`
  }

  let d = decimals
  if (d === undefined) {
    if (abs < 0.01) d = 6
    else if (abs < 1) d = 4
    else if (abs < 100) d = 2
    else d = 2
  }

  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`
}

export function fmtNum(value: number, decimals = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtCompact(value: number): string {
  if (value === 0) return "0"
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toFixed(2)
}

export function fmtPct(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

export function fmtAmount(value: number): string {
  const abs = Math.abs(value)
  if (abs === 0) return "0"
  if (abs < 0.0001) return value.toPrecision(4)
  if (abs < 1) return value.toFixed(6)
  if (abs < 100) return value.toFixed(4)
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

export function fmtTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

export function fmtDate(ts: number): string {
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}
