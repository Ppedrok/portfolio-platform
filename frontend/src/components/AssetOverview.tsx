import { useState, useEffect } from 'react'
import { getAssetOverview } from '../api/client'
import type { CodependenceMethod, OverviewResponse, TickerMatch } from '../types'

// ── Method metadata ───────────────────────────────────────────────────────────

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

// Correlation-range methods (values in [−1, 1]); others live in [0, 1]
const CORRELATION_METHODS = new Set<CodependenceMethod>(['pearson', 'spearman', 'kendall'])

// ── Colour helpers ────────────────────────────────────────────────────────────

/**
 * Maps t ∈ [0, 1] to a colour:
 *   0   → dark navy   #0a1628
 *   0.5 → electric blue #4f8ef7
 *   1   → near-white  #e8eaf0
 * invertColors flips the mapping (used for distance matrix).
 */
function heatColor(t: number, invertColors = false): string {
  const v = invertColors ? 1 - Math.max(0, Math.min(1, t)) : Math.max(0, Math.min(1, t))
  if (v <= 0.5) {
    const s = v * 2
    const r = Math.round(10  + (79  - 10)  * s)
    const g = Math.round(22  + (142 - 22)  * s)
    const b = Math.round(40  + (247 - 40)  * s)
    return `rgb(${r},${g},${b})`
  }
  const s = (v - 0.5) * 2
  const r = Math.round(79  + (232 - 79)  * s)
  const g = Math.round(142 + (234 - 142) * s)
  const b = Math.round(247 + (240 - 247) * s)
  return `rgb(${r},${g},${b})`
}

function textColor(t: number, invertColors = false): string {
  const v = invertColors ? 1 - t : t
  return v > 0.58 ? '#0d1117' : '#e8eaf0'
}

/** Normalize a raw matrix value to [0, 1] for colour mapping. */
function toUnit(value: number, isCorrelation: boolean): number {
  if (isCorrelation) return Math.max(0, Math.min(1, (value + 1) / 2))
  return Math.max(0, Math.min(1, value))
}

// ── SVG heatmap sub-component ─────────────────────────────────────────────────

const CELL      = 44
const LABEL_W   = 70
const LABEL_H   = 66

interface TooltipState { svgX: number; svgY: number; text: string }

interface HeatmapProps {
  tickers:       string[]
  matrix:        Record<string, Record<string, number>>
  title:         string
  invertColors?: boolean
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
        <svg
          width={svgW}
          height={svgH}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* X-axis labels */}
          {tickers.map((t, ci) => (
            <text
              key={`xl-${t}`}
              x={LABEL_W + ci * CELL + CELL / 2}
              y={LABEL_H - 4}
              textAnchor="start"
              transform={`rotate(-42, ${LABEL_W + ci * CELL + CELL / 2}, ${LABEL_H - 4})`}
              fill="#8892a4"
              fontSize={9}
              fontFamily='"JetBrains Mono", monospace'
            >
              {t}
            </text>
          ))}

          {/* Y-axis labels */}
          {tickers.map((t, ri) => (
            <text
              key={`yl-${t}`}
              x={LABEL_W - 6}
              y={LABEL_H + ri * CELL + CELL / 2 + 4}
              textAnchor="end"
              fill="#8892a4"
              fontSize={9}
              fontFamily='"JetBrains Mono", monospace'
            >
              {t}
            </text>
          ))}

          {/* Cells */}
          {tickers.map((rowT, ri) =>
            tickers.map((colT, ci) => {
              const val  = matrix[rowT]?.[colT] ?? 0
              const t    = toUnit(val, isCorrelation)
              const fill = heatColor(t, invertColors)
              const fg   = textColor(t, invertColors)
              const cx   = LABEL_W + ci * CELL
              const cy   = LABEL_H + ri * CELL
              return (
                <g
                  key={`${ri}-${ci}`}
                  onMouseEnter={() =>
                    setTooltip({ svgX: cx + CELL / 2, svgY: cy, text: `${rowT} ↔ ${colT}: ${val.toFixed(3)}` })
                  }
                >
                  <rect
                    x={cx} y={cy}
                    width={CELL - 1} height={CELL - 1}
                    fill={fill}
                    rx={1}
                    className="heatmap-cell"
                  />
                  <text
                    x={cx + CELL / 2}
                    y={cy + CELL / 2 + 3}
                    textAnchor="middle"
                    fill={fg}
                    fontSize={8}
                    fontFamily='"JetBrains Mono", monospace'
                  >
                    {val.toFixed(2)}
                  </text>
                </g>
              )
            })
          )}

          {/* Inline SVG tooltip (avoids positioning hacks) */}
          {tooltip && (
            <g>
              <rect
                x={tooltip.svgX - 56}
                y={tooltip.svgY - 22}
                width={112}
                height={18}
                fill="#0d1117"
                stroke="#1e2530"
                strokeWidth={1}
                rx={3}
              />
              <text
                x={tooltip.svgX}
                y={tooltip.svgY - 9}
                textAnchor="middle"
                fill="#e8eaf0"
                fontSize={9}
                fontFamily='"JetBrains Mono", monospace'
              >
                {tooltip.text}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Colour-scale legend */}
      <div className="flex items-center gap-2 mt-2" style={{ maxWidth: svgW }}>
        <span className="text-[9px] text-muted font-mono">{isCorrelation ? '−1' : '0'}</span>
        <div
          className="h-1.5 flex-1 rounded-full"
          style={{
            background: invertColors
              ? 'linear-gradient(to right, #e8eaf0, #4f8ef7, #0a1628)'
              : 'linear-gradient(to right, #0a1628, #4f8ef7, #e8eaf0)',
          }}
        />
        <span className="text-[9px] text-muted font-mono">1</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  selected:  TickerMatch[]
  startDate: string
  endDate:   string
}

export function AssetOverview({ selected, startDate, endDate }: Props) {
  const [method,       setMethod]       = useState<CodependenceMethod>('pearson')
  const [data,         setData]         = useState<OverviewResponse | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [showDistance, setShowDistance] = useState(false)

  const tickers      = selected.map(t => t.ticker)
  const tickerKey    = tickers.join(',')
  const isCorrelation = CORRELATION_METHODS.has(method)

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
        <span className="text-[10px] font-mono text-accent border border-accent/30 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(79,142,247,0.3)]">
          02
        </span>
        <h2 className="text-sm font-semibold text-[#e8eaf0]">Asset Overview</h2>

        <div className="ml-auto">
          <select
            value={method}
            onChange={e => setMethod(e.target.value as CodependenceMethod)}
            className="bg-[#0d1117] border border-border text-[#e8eaf0] text-xs font-mono rounded px-2 py-1 focus:outline-none focus:border-accent hover:border-accent/50 cursor-pointer"
            style={{ colorScheme: 'dark' }}
          >
            {METHOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats chips */}
      {data && (
        <div className="flex flex-wrap gap-2">
          {data.tickers.map(t => {
            const ret = data.annualized_returns[t]
            const vol = data.annualized_vols[t]
            const sh  = data.sharpes[t]
            const pos = ret != null && ret >= 0
            return (
              <div
                key={t}
                className="bg-card border border-border rounded px-3 py-2 flex items-center gap-3"
              >
                <span className="text-xs font-mono font-semibold text-[#e8eaf0]">{t}</span>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: pos ? '#00d4aa' : '#ff4d6a' }}
                >
                  {ret != null
                    ? `${ret >= 0 ? '+' : ''}${(ret * 100).toFixed(1)}%`
                    : '—'}
                </span>
                <span className="text-[10px] font-mono text-muted">
                  σ {vol != null ? `${(vol * 100).toFixed(1)}%` : '—'}
                </span>
                <span className="text-[10px] font-mono text-muted">
                  SR {sh != null ? sh.toFixed(2) : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-card border border-border rounded-panel p-6 text-center">
          <span className="text-xs text-muted font-mono animate-pulse">
            Computing codependence matrix…
          </span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-negative/8 border border-negative/25 text-negative rounded-panel px-4 py-3 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Heatmaps */}
      {data && !loading && (
        <div className="bg-card border border-border rounded-panel p-4 space-y-6">

          <Heatmap
            tickers={data.tickers}
            matrix={data.codependence}
            title="Codependence Matrix"
            isCorrelation={isCorrelation}
          />

          {/* Distance matrix (collapsible) */}
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

          {/* Method note */}
          <p className="text-[10px] text-muted font-mono border-t border-border pt-3 leading-relaxed">
            {METHOD_NOTES[method]}
          </p>

        </div>
      )}

    </section>
  )
}
