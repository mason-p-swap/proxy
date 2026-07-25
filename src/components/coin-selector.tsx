import { useState } from "react"
import { COINS } from "@/lib/mock-data"
import { usePrices } from "@/lib/prices"
import { fmtUsd } from "@/lib/format"
import { CryptoIcon } from "@/components/crypto-icon"
import { ChevronDown, Search, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type Props = {
  value: string
  onChange: (symbol: string) => void
  exclude?: string
  label?: string
  className?: string
  borderless?: boolean
}

export function CoinSelector({ value, onChange, exclude, label, className, borderless }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const priceOf = usePrices()

  const selected = COINS.find((c) => c.symbol === value)

  const filtered = COINS.filter((c) => {
    if (c.symbol === exclude) return false
    return (
      c.symbol.toLowerCase().includes(query.toLowerCase()) ||
      c.name.toLowerCase().includes(query.toLowerCase())
    )
  })

  const handleSelect = (symbol: string) => {
    onChange(symbol)
    setOpen(false)
    setQuery("")
  }

  return (
    <div className={cn("relative", className)}>
      {label && (
        <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}

      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery("") }}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex h-full w-full items-center gap-1.5 px-3 text-sm transition-colors focus-visible:outline-none",
              borderless
                ? "bg-transparent hover:bg-white/5"
                : "rounded-lg border border-input bg-background/50 py-2.5 hover:border-foreground/30"
            )}
          >
            {selected && <CryptoIcon symbol={selected.symbol} size={18} />}
            <span className="font-bold">{selected?.symbol ?? "–"}</span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-72 p-0 rounded-xl border-border bg-popover shadow-2xl"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search coin..."
              className="h-6 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>

          <div className="scrollbar-none max-h-64 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.symbol}
                onClick={() => handleSelect(c.symbol)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <CryptoIcon symbol={c.symbol} size={20} />
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{c.symbol}</span>
                  <span className="text-[10px] text-muted-foreground">{c.name}</span>
                </div>
                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                  {fmtUsd(priceOf(c.symbol))}
                </span>
                {c.symbol === value && <Check className="size-3.5 shrink-0 text-foreground" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">no results</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
