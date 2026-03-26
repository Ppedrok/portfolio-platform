import { useState, useEffect } from 'react'
import { getAssetOverview } from '../api/client'
import type { CodependenceMethod, OverviewResponse, TickerMatch } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

type OverviewTab = 'performance' | 'periods' | 'codependence'

// ── Codependence method metadata ──────────────────────────────────────────────

const METHOD_OPTIONS: { value: CodependenceMethod; label: string }[] = [
  { value: 'pearson',     label: 'Pearson Correlation' },
  { value: 'spearman',    label: 'Spearman Correlation' },
  { value: 'kendall',     label: 'Kendall Tau' },
  { value: 'gerber2',     label: 'Gerber Statistics (Modified)' },
  { value: 'distance',    label: 'Distance Correlation' },
  { value: 'mutual_info', label: 'Mutual Information' },
  { value: 'tail',        label: 'Tail Dependence Coefficient' },
]

const METHOD_NOTES: Record<CodependenceMethod, string> = {
  pearson:     'Linear correlation coefficient. Values close to 1 indicate strong positive co-movement; near −1 strong inverse co-movement.',
  spearman:    'Rank-based correlation. More robust to outliers than Pearson; captures monotonic (not necessarily linear) relationships.',
  kendall:     'Kendall Tau rank correlation. Measures ordinal association; particularly robust for small samples and non-normal return distributions.',
  gerber2:     'Modified Gerber statistic. Focuses on co-movements that exceed a significance threshold, filtering out small day-to-day noise.',
  distance:    'Distance correlation. Zero only when assets are truly statistically independent; captures both linear and non-linear dependencies.',
  mutual_info: 'Mutual information. Measures all forms of shared information between asset return distributions, including non-linear structure.',
  tail:        'Tail dependence coefficient. Quantifies the probability that both assets experience extreme moves simultaneously.',
}

const CORRELATION_METHODS = new Set<CodependenceMethod>(['pearson', 'spearman', 'kendall'])

// ── Colour helpers ─────────────────────────────────────────────────────────────

/** Map t ∈ [0,1] → amber–dark gradient (warm palette). */
function heatColor(t: number, invertColors = false): string {
  const v = invertColors ? 1 - Math.max(0, Math.min(1, t)) : Math.max(0, Math.min(1, t))
  if (v <= 0.5) {
    const s = v * 2
    const r = Math.round(10  + (80  - 10)  * s)
    const g = Math.round(8   + (40  - 8)   * s)
    const b = Math.round(4   + (8   - 4)   * s)
    return `rgb(${r},${g},${b})`
  }
  const s = (v - 0.5) * 2
  const r = Math.round(80  + (245 - 80)  * s)
  const g = Math.round(40  + (158 - 40)  * s)
  const b = Math.round(8   + (11  - 8)   * s)
  return `rgb(${r},${g},${b})`
}

function textColor(t: number, invertColors = false): string {
  const v = invertColors ? 1 - t : t
  return v > 0.55 ? '#0a0804' : '#f0e8d4'
}

function toUnit(value: number, isCorrelation: boolean): number {
  if (isCorrelation) return Math.max(0, Math.min(1, (value + 1) / 2))
  return Math.max(0, Math.min(1, value))
}

/** Map a return value to a red→white→green gradient colour. */
function returnColor(v: number | null): string {
  if (v === null) return '#2a1e08'
  if (v === 0) return '#1a1608'
  const abs = Math.min(Math.abs(v), 0.5) / 0.5  // cap at 50% for saturation
  if (v > 0) {
    const r = Math.round(10  + (34  - 10)  * (1 - abs))
    const g = Math.round(8   + (197 - 8)   * abs)
    const b = Math.round(4   + (94  - 4)   * abs)
    return `rgba(${r},${g},${b},0.35)`
  } else {
    const r = Math.round(10  + (239 - 10)  * abs)
    const g = Math.round(8   + (68  - 8)   * (1 - abs))
    const b = Math.round(4)
    return `rgba(${r},${g},${b},0.30)`
  }
}

function returnTextColor(v: number | null): string {
  if (v === null) return '#7a6848'
  return v >= 0 ? '#22c55e' : '#ef4444'
}

function pct(v: number | null, dec = 1): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(dec)}%`
}

function fmt(v: number | null, dec = 2): string {
  if (v === null) return '—'
  return v.toFixed(dec)
}

// ── Heatmap component ─────────────────────────────────────────────────────────

const CELL    = 44
const LABEL_W = 70
const LABEL_H = 66

interface TooltipState { svgX: number; svgY: number; text: string }

interface HeatmapProps {
  tickers:        string[]
  matrix:         Record<string, Record<string, number>>
  title:          string
  invertColors?:  boolean
  isCorrelation?: boolean
}

function Heatmap({ tickers, matrix, title, invertColors = false, isCorrelation = false }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const n    = tickers.length
  const svgW = LABEL_W + n * CELL
  const svgH = LABEL_H + n * CELL

  return (
    <div className="relative select-none">
      <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-3">{title}</p>
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} onMouseLeave={() => setTooltip(null)}>
          {tickers.map((t, ci) => (
            <text
              key={`xl-${t}`}
              x={LABEL_W + ci * CELL + CELL / 2}
              y={LABEL_H - 4}
              textAnchor="start"
              transform={`rotate(-42, ${LABEL_W + ci * CELL + CELL / 2}, ${LABEL_H - 4})`}
              fill="#7a6848" fontSize={9} fontFamily='"JetBrains Mono", monospace'
            >{t}</text>
          ))}
          {tickers.map((t, ri) => (
            <text
              key={`yl-${t}`}
              x={LABEL_W - 6}
              y={LABEL_H + ri * CELL + CELL / 2 + 4}
              textAnchor="end"
              fill="#7a6848" fontSize={9} fontFamily='"JetBrains Mono", monospace'
            >{t}</text>
          ))}
          {tickers.map((rowT, ri) =>
            tickers.map((colT, ci) => {
              const val  = matrix[rowT]?.[colT] ?? 0
              const t    = toUnit(val, isCorrelation)
              const fill = heatColor(t, invertColors)
              const fg   = textColor(t, invertColors)
              const cx   = LABEL_W + ci * CELL
              const cy   = LABEL_H + ri * CELL
              return (
                <g key={`${ri}-${ci}`}
                   onMouseEnter={() => setTooltip({ svgX: cx + CELL / 2, svgY: cy, text: `${rowT} ↔ ${colT}: ${val.toFixed(3)}` })}
                >
                  <rect x={cx} y={cy} width={CELL - 1} height={CELL - 1}
                        fill={fill} rx={1} className="heatmap-cell" />
                  <text x={cx + CELL / 2} y={cy + CELL / 2 + 3}
                        textAnchor="middle" fill={fg} fontSize={8}
                        fontFamily='"JetBrains Mono", monospace'>
                    {val.toFixed(2)}
                  </text>
                </g>
              )
            })
          )}
          {tooltip && (
            <g>
              <rect x={tooltip.svgX - 62} y={tooltip.svgY - 22} width={124} height={18}
                    fill="#100d06" stroke="#2a1e08" strokeWidth={1} rx={3} />
              <text x={tooltip.svgX} y={tooltip.svgY - 9} textAnchor="middle"
                    fill="#f0e8d4" fontSize={9} fontFamily='"JetBrains Mono", monospace'>
                {tooltip.text}
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="flex items-center gap-2 mt-2" style={{ maxWidth: svgW }}>
        <span className="text-[9px] text-muted font-mono">{isCorrelation ? '−1' : '0'}</span>
        <div className="h-1.5 flex-1 rounded-full" style={{
          background: invertColors
            ? 'linear-gradient(to right, #f59e0b, #501408, #0a0804)'
            : 'linear-gradient(to right, #0a0804, #501408, #f59e0b)',
        }} />
        <span className="text-[9px] text-muted font-mono">1</span>
      </div>
    </div>
  )
}

// ── Performance table ─────────────────────────────────────────────────────────

const PERF_COLS: { key: keyof OverviewResponse; label: string; tip: string; fmt: (v: number | null) => string; color?: boolean }[] = [
  { key: 'annualized_returns', label: 'Return',  tip: 'Annualized geometric return',          fmt: v => pct(v, 1), color: true },
  { key: 'annualized_vols',    label: 'Vol',     tip: 'Annualized volatility (daily std×√252)', fmt: v => pct(v, 1) },
  { key: 'sharpes',            label: 'Sharpe',  tip: 'Sharpe ratio (μ / σ, rf=0)',             fmt: v => fmt(v, 2), color: true },
  { key: 'sortinos',           label: 'Sortino', tip: 'Sortino ratio (μ / downside σ)',         fmt: v => fmt(v, 2), color: true },
  { key: 'calmars',            label: 'Calmar',  tip: 'Calmar ratio (μ / |Max DD|)',            fmt: v => fmt(v, 2), color: true },
  { key: 'max_drawdowns',      label: 'Max DD',  tip: 'Maximum peak-to-trough drawdown',        fmt: v => pct(v, 1), color: true },
  { key: 'vars_95',            label: 'VaR 95%', tip: 'Historical Value at Risk (5th percentile daily)', fmt: v => pct(v, 2) },
  { key: 'cvars_95',           label: 'CVaR 95%',tip: 'Conditional VaR — expected loss beyond VaR',      fmt: v => pct(v, 2) },
  { key: 'skews',              label: 'Skew',    tip: 'Return distribution skewness (negative = left tail)', fmt: v => fmt(v, 2) },
  { key: 'kurts',              label: 'XKurt',   tip: 'Excess kurtosis (0 = normal; >0 = fat tails)',      fmt: v => fmt(v, 2) },
  { key: 'win_rates',          label: 'Win%',    tip: 'Fraction of positive daily returns',    fmt: v => pct(v, 1) },
]

function PerformanceTable({ data }: { data: OverviewResponse }) {
  const [sortCol, setSortCol] = useState<string>('annualized_returns')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const tickers = [...data.tickers].sort((a, b) => {
    const colDef = PERF_COLS.find(c => c.key === sortCol)
    if (!colDef) return 0
    const aVal = (data[colDef.key] as Record<string, number | null>)[a] ?? -Infinity
    const bVal = (data[colDef.key] as Record<string, number | null>)[b] ?? -Infinity
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal
  })

  function toggleSort(key: string) {
    if (key === sortCol) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(key); setSortDir('desc') }
  }

  return (
    <div>
      <p className="text-[9px] font-mono text-muted mb-3 italic">
        Click column headers to sort. All returns are annualized.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-muted tracking-widest uppercase font-medium">Asset</th>
              {PERF_COLS.map(col => (
                <th
                  key={col.key}
                  title={col.tip}
                  onClick={() => toggleSort(col.key)}
                  className={`text-right py-2 px-2 tracking-widest uppercase font-medium cursor-pointer select-none transition-colors ${
                    sortCol === col.key ? 'text-accent' : 'text-muted hover:text-muted-bright'
                  }`}
                >
                  {col.label}
                  {sortCol === col.key && (
                    <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((t, i) => (
              <tr
                key={t}
                className="border-b border-border/40 hover:bg-accent/5 transition-colors"
              >
                <td className="py-2.5 pr-4 font-bold text-accent">{t}</td>
                {PERF_COLS.map(col => {
                  const raw = (data[col.key] as Record<string, number | null>)[t] ?? null
                  const formatted = col.fmt(raw)
                  const colored   = col.color && raw !== null
                  let textCls = 'text-[#f0e8d4]'
                  if (colored) {
                    if (col.key === 'max_drawdowns' || col.key === 'vars_95' || col.key === 'cvars_95') {
                      // Lower is worse
                      textCls = raw < 0 ? 'text-negative' : 'text-positive'
                    } else {
                      textCls = raw >= 0 ? 'text-positive' : 'text-negative'
                    }
                  }
                  return (
                    <td key={col.key} className={`text-right py-2.5 px-2 tabular-nums ${textCls}`}>
                      {formatted}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Period returns table ───────────────────────────────────────────────────────

const PERIOD_COLS = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y'] as const

function PeriodReturnsTable({ data }: { data: OverviewResponse }) {
  return (
    <div>
      <p className="text-[9px] font-mono text-muted mb-3 italic">
        Historical price returns over each period, ending at the last available date.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-muted tracking-widest uppercase font-medium">Asset</th>
              {PERIOD_COLS.map(p => (
                <th key={p} className="text-right py-2 px-3 text-muted tracking-widest uppercase font-medium">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.tickers.map(t => {
              const pr = data.period_returns?.[t] ?? {}
              return (
                <tr key={t} className="border-b border-border/40">
                  <td className="py-2.5 pr-4 font-bold text-accent">{t}</td>
                  {PERIOD_COLS.map(period => {
                    const v = pr[period] ?? null
                    return (
                      <td
                        key={period}
                        className="text-right py-2.5 px-3 tabular-nums font-semibold"
                        style={{
                          background: returnColor(v),
                          color:      returnTextColor(v),
                        }}
                      >
                        {pct(v, 1)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mini sparkline legend */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
        <span className="text-[9px] font-mono text-muted">Color scale:</span>
        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold" style={{ background: 'rgba(239,68,68,0.28)', color: '#ef4444' }}>−50%+</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'linear-gradient(to right, rgba(239,68,68,0.30), #1a1608, rgba(34,197,94,0.35))' }} />
        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold" style={{ background: 'rgba(34,197,94,0.28)', color: '#22c55e' }}>+50%+</span>
      </div>
    </div>
  )
}

// ── Codependence tab ──────────────────────────────────────────────────────────

function CodependenceTab({
  data,
  method,
  onMethodChange,
}: {
  data:           OverviewResponse
  method:         CodependenceMethod
  onMethodChange: (m: CodependenceMethod) => void
}) {
  const [showDistance, setShowDistance] = useState(false)
  const isCorrelation = CORRELATION_METHODS.has(method)

  return (
    <div className="space-y-6">
      {/* Method picker */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Method</span>
        <select
          value={method}
          onChange={e => onMethodChange(e.target.value as CodependenceMethod)}
          className="bg-[#0a0804] border border-border text-[#f0e8d4] text-xs font-mono rounded px-2 py-1 focus:outline-none focus:border-accent hover:border-border-bright cursor-pointer"
          style={{ colorScheme: 'dark' }}
        >
          {METHOD_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <Heatmap
        tickers={data.tickers}
        matrix={data.codependence}
        title="Codependence Matrix"
        isCorrelation={isCorrelation}
      />

      <div>
        <button
          onClick={() => setShowDistance(v => !v)}
          className="text-[10px] font-mono text-accent hover:opacity-80 flex items-center gap-1.5"
        >
          <span>{showDistance ? '▾' : '▸'}</span>
          {showDistance ? 'Hide' : 'Show'} Distance Matrix
        </button>
        {showDistance && (
          <div className="mt-4">
            <Heatmap
              tickers={data.tickers}
              matrix={data.distance}
              title="Distance Matrix"
              invertColors
              isCorrelation={false}
            />
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted font-mono border-t border-border pt-3 leading-relaxed">
        {METHOD_NOTES[method]}
      </p>
    </div>
  )
}

// ── Summary chips ─────────────────────────────────────────────────────────────

function SummaryChips({ data }: { data: OverviewResponse }) {
  return (
    <div className="flex flex-wrap gap-2">
      {data.tickers.map(t => {
        const ret = data.annualized_returns[t]
        const vol = data.annualized_vols[t]
        const sh  = data.sharpes[t]
        const dd  = data.max_drawdowns?.[t]
        return (
          <div
            key={t}
            className="bg-[#0a0804] border border-border rounded-panel px-3 py-2 flex items-center gap-3 min-w-0"
          >
            <span className="text-xs font-mono font-bold text-accent shrink-0">{t}</span>
            <span className="text-[10px] font-mono shrink-0" style={{ color: (ret ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
              {pct(ret, 1)}
            </span>
            <span className="text-[10px] font-mono text-muted shrink-0">σ {pct(vol, 1)}</span>
            <span className="text-[10px] font-mono text-muted shrink-0">SR {fmt(sh)}</span>
            {dd !== undefined && dd !== null && (
              <span className="text-[10px] font-mono text-negative shrink-0">DD {pct(dd, 1)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  selected:  TickerMatch[]
  startDate: string
  endDate:   string
}

type OverviewTabConfig = { id: OverviewTab; label: string; icon: string }
const TABS: OverviewTabConfig[] = [
  { id: 'performance',  label: 'Performance',     icon: '◈' },
  { id: 'periods',      label: 'Period Returns',  icon: '◧' },
  { id: 'codependence', label: 'Codependence',    icon: '⬡' },
]

export function AssetOverview({ selected, startDate, endDate }: Props) {
  const [method,  setMethod]  = useState<CodependenceMethod>('pearson')
  const [data,    setData]    = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [tab,     setTab]     = useState<OverviewTab>('performance')

  const tickers   = selected.map(t => t.ticker)
  const tickerKey = tickers.join(',')

  useEffect(() => {
    if (tickers.length < 2) { setData(null); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    getAssetOverview({ tickers, start: startDate, end: endDate, method })
      .then(res  => { if (!cancelled) { setData(res);  setLoading(false) } })
      .catch(err => { if (!cancelled) { setError(err instanceof Error ? err.message : String(err)); setLoading(false) } })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, startDate, endDate, method])

  return (
    <section className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="terminal-label border border-accent/40 text-accent bg-accent/5 px-2 py-0.5 rounded">
          02
        </span>
        <h2 className="text-sm font-semibold text-[#f0e8d4] uppercase tracking-wider">Asset Overview</h2>
        <span className="text-[9px] font-mono text-muted border border-border rounded px-1.5 py-0.5">
          {tickers.length} assets · {startDate} → {endDate}
        </span>
      </div>

      {/* Summary chips */}
      {data && !loading && <SummaryChips data={data} />}

      {/* Loading */}
      {loading && (
        <div className="bg-card card-top-accent border border-border rounded-panel p-6 text-center">
          <span className="text-xs text-muted font-mono animate-pulse">
            Computing asset statistics…
          </span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-negative/8 border border-negative/25 text-negative rounded-panel px-4 py-3 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Main card */}
      {data && !loading && (
        <div className="bg-card card-top-accent border border-border rounded-panel p-5">

          {/* Tab bar */}
          <div className="flex border-b border-border mb-5 gap-0">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-mono uppercase tracking-widest border-b-2 -mb-px transition-all ${
                  tab === id
                    ? 'border-accent text-accent bg-accent/5'
                    : 'border-transparent text-muted hover:text-muted-bright'
                }`}
              >
                <span className="text-[11px]">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'performance'  && <PerformanceTable data={data} />}
          {tab === 'periods'      && <PeriodReturnsTable data={data} />}
          {tab === 'codependence' && (
            <CodependenceTab
              data={data}
              method={method}
              onMethodChange={setMethod}
            />
          )}

        </div>
      )}

    </section>
  )
}
