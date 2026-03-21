import { useState, useEffect, useRef } from 'react'
import { searchAssets } from '../api/client'
import type { TickerMatch } from '../types'
import { AssetChip } from './AssetChip'

interface Props {
  selected:     TickerMatch[]
  onAdd:        (t: TickerMatch) => void
  onRemove:     (ticker: string) => void
  startDate:    string
  endDate:      string
  onStartDate:  (d: string) => void
  onEndDate:    (d: string) => void
}

export function AssetSearch({
  selected, onAdd, onRemove,
  startDate, endDate, onStartDate, onEndDate,
}: Props) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<TickerMatch[]>([])
  const [open, setOpen]       = useState(false)
  const [busy, setBusy]       = useState(false)
  const debounceRef           = useRef<ReturnType<typeof setTimeout>>()
  const containerRef          = useRef<HTMLDivElement>(null)

  const selectedTickers = new Set(selected.map(t => t.ticker))

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 1) { setResults([]); setOpen(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setBusy(true)
      try {
        const res = await searchAssets(query.trim())
        setResults(res.results)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setBusy(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSelect(t: TickerMatch) {
    if (!selectedTickers.has(t.ticker)) onAdd(t)
    setQuery('')
    setOpen(false)
  }

  return (
    <section className="bg-card rounded-2xl p-6 shadow-card border border-border">
      <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-[#6366f120] flex items-center justify-center text-[#6366f1] text-xs font-bold">1</span>
        Asset Selection
      </h2>

      {/* Search input */}
      <div className="relative mb-4" ref={containerRef}>
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search ticker or company name…"
            className="w-full bg-bg border border-border rounded-xl pl-11 pr-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          {busy && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2">
              <svg className="animate-spin w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </span>
          )}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            {results.map(r => (
              <button
                key={r.ticker}
                onClick={() => handleSelect(r)}
                disabled={selectedTickers.has(r.ticker)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm transition-colors ${
                  selectedTickers.has(r.ticker)
                    ? 'opacity-40 cursor-default'
                    : 'hover:bg-white/5 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-[#6366f1] w-20 shrink-0">{r.ticker}</span>
                  <span className="text-white">{r.name}</span>
                </span>
                <span className="text-muted text-xs shrink-0">{r.exchange} · {r.asset_type}</span>
              </button>
            ))}
          </div>
        )}
        {open && results.length === 0 && !busy && query.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-muted">
            No results for "{query}"
          </div>
        )}
      </div>

      {/* Selected chips */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-5">
          {selected.map(t => (
            <AssetChip key={t.ticker} ticker={t.ticker} name={t.name} onRemove={onRemove} />
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm mb-5">
          Search and select at least 2 assets to get started.
        </p>
      )}

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        {([
          ['Start Date', startDate, onStartDate],
          ['End Date',   endDate,   onEndDate],
        ] as const).map(([label, value, onChange]) => (
          <div key={label}>
            <label className="block text-xs text-muted mb-1.5 font-medium uppercase tracking-wide">
              {label}
            </label>
            <input
              type="date"
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
