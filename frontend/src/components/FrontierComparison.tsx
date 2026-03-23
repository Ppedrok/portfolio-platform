/**
 * FrontierComparison.tsx
 * ----------------------
 * Overlay multiple efficient frontiers (one per OptMethod) on a single chart
 * to visually compare how different risk measures shape the opportunity set.
 *
 * Features:
 *   - Multi-select method grid with "heavy" warnings for GMD/Brownian
 *   - Parallel API calls (Promise.allSettled) per selected method
 *   - ScatterChart with one coloured Scatter series per method
 *   - Interactive tooltip showing all method returns at a given volatility
 *   - Summary stats table: Min-Vol, Max-Return, Max-Sharpe per frontier
 */

import { useState, useCallback, useEffect } from 'react'
import {
  ScatterChart, Scatter,
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { OptMethod, FrontierResponse, FrontierPoint } from '../types'
import { optimizePortfolio } from '../api/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  markowitz:            '#2563eb',   // blue
  CVaR:                 '#10b981',   // emerald
  MAD:                  '#f59e0b',   // amber
  SMAD:                 '#e879f9',   // fuchsia
  SemiVariance:         '#38bdf8',   // sky
  LowerPartialMoments:  '#fb923c',   // orange
  EVaR:                 '#a78bfa',   // violet
  Ulcer:                '#f43f5e',   // rose
  GMD:                  '#84cc16',   // lime
  Brownian:             '#06b6d4',   // cyan
}

// Distinct dash patterns so overlapping lines remain distinguishable
const METHOD_DASH: Record<string, string | undefined> = {
  markowitz:            undefined,        // solid
  CVaR:                 '6 3',            // medium dash
  MAD:                  '2 3',            // dots
  SMAD:                 '10 3 2 3',       // long-dot
  SemiVariance:         '12 4',           // long dash
  LowerPartialMoments:  '4 2 4 2',        // equal dash
  EVaR:                 '1 4',            // sparse dots
  Ulcer:                '8 2 2 2',        // dash-dot-dash
  GMD:                  '16 4',           // very long dash
  Brownian:             '3 3 8 3',        // short-long
}

// Stroke widths: vary so overlapping lines have slightly different visual weight
const METHOD_WIDTH: Record<string, number> = {
  markowitz:            2.5,
  CVaR:                 2.0,
  MAD:                  2.0,
  SMAD:                 1.8,
  SemiVariance:         1.8,
  LowerPartialMoments:  1.8,
  EVaR:                 2.0,
  Ulcer:                2.0,
  GMD:                  2.0,
  Brownian:             2.0,
}

interface MethodDef { id: OptMethod; label: string; heavy?: boolean }

const ALL_METHODS: MethodDef[] = [
  { id: 'markowitz',            label: 'Markowitz (MVO)' },
  { id: 'CVaR',                 label: 'CVaR' },
  { id: 'MAD',                  label: 'MAD' },
  { id: 'SMAD',                 label: 'SMAD' },
  { id: 'SemiVariance',         label: 'Semi-Variance' },
  { id: 'LowerPartialMoments',  label: 'Lower Partial Moments' },
  { id: 'EVaR',                 label: 'EVaR' },
  { id: 'Ulcer',                label: 'Ulcer Index' },
  { id: 'GMD',                  label: 'GMD',    heavy: true },
  { id: 'Brownian',             label: 'Brownian Motion', heavy: true },
]

const GRID_COLOR  = '#1a2035'
const AXIS_COLOR  = '#5a6a85'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MethodState {
  status:  'idle' | 'loading' | 'done' | 'error'
  data?:   FrontierResponse
  error?:  string
}

interface ChartPoint { x: number; y: number }

// ── Custom scatter tooltip ─────────────────────────────────────────────────────

function CompareTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: ChartPoint; fill: string; name: string }[]
}) {
  if (!active || !payload?.length) return null
  const pt    = payload[0].payload
  const fill  = payload[0].fill
  const name  = payload[0].name

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid rgba(56,189,248,0.3)',
      borderRadius: 8,
      padding: '8px 12px',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11,
      minWidth: 200,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, backgroundColor: fill }} />
        <span style={{ color: '#e8eaf0', fontWeight: 700 }}>{name}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 3 }}>
        <span style={{ color: '#8892a4' }}>Return</span>
        <span style={{ color: '#00d4aa', fontWeight: 700 }}>{pt.y.toFixed(2)}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 3 }}>
        <span style={{ color: '#8892a4' }}>Volatility</span>
        <span style={{ color: '#4f8ef7', fontWeight: 700 }}>{pt.x.toFixed(2)}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
        <span style={{ color: '#8892a4' }}>Sharpe</span>
        <span style={{ color: '#f59e0b', fontWeight: 700 }}>
          {pt.x > 0 ? (pt.y / pt.x).toFixed(3) : '—'}
        </span>
      </div>
    </div>
  )
}

// ── Summary stats ──────────────────────────────────────────────────────────────

/** Return the frontier point with the highest Sharpe ratio */
function maxSharpePortfolio(fr: FrontierResponse): FrontierPoint | null {
  const pts = fr.portfolios.filter(
    p => p.expected_return != null && p.expected_volatility != null && p.expected_volatility! > 0
  )
  if (!pts.length) return null
  return pts.reduce((best, p) => {
    const s  = p.expected_return!  / p.expected_volatility!
    const bs = best.expected_return! / best.expected_volatility!
    return s > bs ? p : best
  })
}

function computeStats(fr: FrontierResponse) {
  const pts = fr.portfolios.filter(
    p => p.expected_return != null && p.expected_volatility != null
  )
  if (!pts.length) return null

  const minVol = pts.reduce((a, b) =>
    (a.expected_volatility! < b.expected_volatility! ? a : b))
  const maxRet = pts.reduce((a, b) =>
    (a.expected_return! > b.expected_return! ? a : b))
  const maxSharpe = pts.reduce((a, b) => {
    const sa = (a.expected_return! / (a.expected_volatility! || 1))
    const sb = (b.expected_return! / (b.expected_volatility! || 1))
    return sa > sb ? a : b
  })

  return {
    minVol:    { ret: minVol.expected_return!   * 100, vol: minVol.expected_volatility!   * 100 },
    maxRet:    { ret: maxRet.expected_return!   * 100, vol: maxRet.expected_volatility!   * 100 },
    maxSharpe: {
      ret:    maxSharpe.expected_return!    * 100,
      vol:    maxSharpe.expected_volatility! * 100,
      sharpe: maxSharpe.expected_return! / (maxSharpe.expected_volatility! || 1),
    },
    n: pts.length,
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  tickers:          string[]
  startDate:        string
  endDate:          string
  muMethod:         string
  covMethod:        string
  maxWeight:        number
  minWeight:        number
  longOnly:         boolean
  onLoadingChange?: (loading: boolean) => void
}

// ── Main component ────────────────────────────────────────────────────────────

export function FrontierComparison({
  tickers, startDate, endDate,
  muMethod, covMethod,
  maxWeight, minWeight, longOnly,
  onLoadingChange,
}: Props) {
  const [selected, setSelected]   = useState<Set<OptMethod>>(new Set(['CVaR', 'markowitz']))
  const [results,  setResults]    = useState<Map<string, MethodState>>(new Map())
  const [running,  setRunning]    = useState(false)

  // Notify parent whenever running changes
  useEffect(() => { onLoadingChange?.(running) }, [running, onLoadingChange])

  const toggle = (id: OptMethod) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const runComparison = useCallback(async () => {
    if (tickers.length < 2 || selected.size === 0) return
    setRunning(true)

    // Mark all selected as loading
    const initial = new Map<string, MethodState>()
    selected.forEach(m => initial.set(m, { status: 'loading' }))
    setResults(initial)

    // Run all in parallel
    const entries = Array.from(selected)
    const settled = await Promise.allSettled(
      entries.map(method =>
        optimizePortfolio({
          tickers,
          start:          startDate,
          end:            endDate,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mu_method:      muMethod as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          cov_method:     covMethod as any,
          opt_method:     method,
          target_return:  'frontier',
          constraints:    { max_weight: maxWeight, min_weight: minWeight },
          rp_constraints: null,
          asset_groups:   null,
          bl_views:       null,
          long_only:      longOnly,
          solver:         'CLARABEL',
        })
      )
    )

    const final = new Map<string, MethodState>()
    entries.forEach((method, i) => {
      const res = settled[i]
      if (res.status === 'fulfilled') {
        const val = res.value
        if ('portfolios' in val) {
          final.set(method, { status: 'done', data: val as FrontierResponse })
        } else {
          final.set(method, { status: 'error', error: 'Response was not a frontier.' })
        }
      } else {
        final.set(method, { status: 'error', error: String(res.reason?.message ?? res.reason) })
      }
    })
    setResults(final)
    setRunning(false)
  }, [tickers, startDate, endDate, muMethod, covMethod, maxWeight, minWeight, longOnly, selected])

  // ── Chart data ─────────────────────────────────────────────────────────────

  const doneEntries = Array.from(results.entries()).filter(
    ([, v]) => v.status === 'done' && v.data
  ) as [string, Required<Pick<MethodState, 'data'>> & MethodState][]

  const hasAnyResults = doneEntries.length > 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Method selector ── */}
      <div>
        <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-3">
          Select Optimization Methods to Compare
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_METHODS.map(({ id, label, heavy }) => {
            const isSelected = selected.has(id)
            const color      = METHOD_COLORS[id] ?? '#8892a4'
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                disabled={running}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded text-xs font-mono
                  border transition-all disabled:opacity-40 disabled:cursor-not-allowed
                  ${isSelected
                    ? 'text-[#e8eaf0] bg-[#0b0f1a]'
                    : 'text-muted bg-[#07090f] hover:text-muted-bright border-border'
                  }
                `}
                style={isSelected
                  ? { borderColor: color, boxShadow: `0 0 8px ${color}30` }
                  : undefined
                }
              >
                {/* Colour swatch */}
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0 transition-opacity"
                  style={{ backgroundColor: color, opacity: isSelected ? 1 : 0.3 }}
                />
                <span className="flex-1 text-left">{label}</span>
                {heavy && (
                  <span className="text-[9px] text-amber-500 font-bold shrink-0">⚠</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Run button */}
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={runComparison}
            disabled={running || selected.size === 0 || tickers.length < 2}
            className="px-5 py-2 rounded text-xs font-bold font-mono uppercase tracking-wider text-white
                       disabled:opacity-35 disabled:cursor-not-allowed transition-all"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: '1px solid rgba(59,130,246,0.25)',
              boxShadow: running ? 'none' : '0 0 16px rgba(37,99,235,0.25)',
            }}
          >
            {running
              ? `Computing ${selected.size} frontier${selected.size > 1 ? 's' : ''}…`
              : `Compare ${selected.size} Frontier${selected.size > 1 ? 's' : ''}`
            }
          </button>
          {selected.size > 0 && (
            <span className="text-[10px] text-muted font-mono">
              {Array.from(selected).map(m => {
                const def = ALL_METHODS.find(x => x.id === m)
                return def?.label ?? m
              }).join(' · ')}
            </span>
          )}
        </div>
      </div>

      {/* ── Per-method status badges ── */}
      {results.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(results.entries()).map(([method, state]) => {
            const color = METHOD_COLORS[method] ?? '#8892a4'
            const def   = ALL_METHODS.find(m => m.id === method)
            return (
              <div
                key={method}
                className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono"
                style={{
                  borderColor: state.status === 'error' ? '#f43f5e60' : `${color}50`,
                  background:  state.status === 'error' ? '#2a0a0a' : '#0b0f1a',
                  color:       state.status === 'error' ? '#f43f5e' : '#8892a4',
                }}
              >
                {state.status === 'loading' && (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                )}
                {state.status === 'done' && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                )}
                {state.status === 'error' && (
                  <span className="text-[#f43f5e] font-bold">✕</span>
                )}
                <span style={{ color: state.status === 'done' ? '#c8d0e0' : undefined }}>
                  {def?.label ?? method}
                </span>
                {state.status === 'error' && (
                  <span className="ml-1 text-[9px] opacity-70 max-w-[160px] truncate" title={state.error}>
                    {state.error}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Frontier overlay chart ── */}
      {hasAnyResults && (
        <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
          <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-1">
            Efficient Frontier Comparison
          </p>
          <p className="text-[10px] text-muted font-mono mb-4">
            Each curve represents the risk-return opportunity set for a different risk objective.
            Frontiers further to the upper-left dominate (higher return per unit of risk).
          </p>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4">
            {doneEntries.map(([method]) => {
              const color = METHOD_COLORS[method] ?? '#8892a4'
              const dash  = METHOD_DASH[method]
              const w     = METHOD_WIDTH[method] ?? 2
              const def   = ALL_METHODS.find(m => m.id === method)
              return (
                <div key={method} className="flex items-center gap-2">
                  {/* SVG line swatch showing actual dash pattern */}
                  <svg width="28" height="10" style={{ overflow: 'visible' }}>
                    <line
                      x1="0" y1="5" x2="28" y2="5"
                      stroke={color}
                      strokeWidth={w}
                      strokeDasharray={dash ?? undefined}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="font-mono text-[10px] text-muted-bright">
                    {def?.label ?? method}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Overlap notice */}
          {doneEntries.length > 1 && (() => {
            const allStats = doneEntries.map(([m, s]) => computeStats(s.data!))
            const first = allStats[0]
            const allSame = first && allStats.every(s =>
              s && Math.abs(s.maxSharpe.sharpe - first.maxSharpe.sharpe) < 0.001 &&
              Math.abs(s.minVol.vol - first.minVol.vol) < 0.01
            )
            if (!allSame) return null
            return (
              <div className="mb-3 px-3 py-2 rounded border border-amber-500/20 bg-amber-500/5 text-[10px] font-mono text-amber-400 leading-relaxed">
                ⚠ Frontiers overlap — with <span className="text-[#e8eaf0]">historical μ / ledoit-wolf Σ</span> and elliptically distributed returns,
                different risk measures produce nearly identical (σ, μ) loci.
                Try switching to <span className="text-[#e8eaf0]">FF3/FF5 mu+cov</span> or a non-parametric covariance for visible divergence.
                Dash patterns still distinguish each series.
              </div>
            )
          })()}

          <ResponsiveContainer width="100%" height={440}>
            <ScatterChart margin={{ top: 10, right: 24, bottom: 36, left: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={GRID_COLOR} />
              <XAxis
                type="number"
                dataKey="x"
                name="Volatility"
                unit="%"
                tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
                label={{ value: 'Expected Volatility (%)', position: 'insideBottom', offset: -20, fill: AXIS_COLOR, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Return"
                unit="%"
                tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
                label={{ value: 'Expected Return (%)', angle: -90, position: 'insideLeft', offset: 12, fill: AXIS_COLOR, fontSize: 11 }}
              />
              <Tooltip
                content={<CompareTooltip />}
                cursor={{ strokeDasharray: '3 3', stroke: '#334155' }}
              />
              {doneEntries.map(([method, state]) => {
                const color  = METHOD_COLORS[method] ?? '#8892a4'
                const dash   = METHOD_DASH[method]
                const lw     = METHOD_WIDTH[method] ?? 2
                const def    = ALL_METHODS.find(m => m.id === method)
                const points: ChartPoint[] = state.data!.portfolios
                  .filter(p => p.expected_return != null && p.expected_volatility != null)
                  .sort((a, b) => a.expected_volatility! - b.expected_volatility!)
                  .map(p => ({
                    x: +((p.expected_volatility! * 100).toFixed(3)),
                    y: +((p.expected_return!    * 100).toFixed(3)),
                  }))
                return (
                  <Scatter
                    key={method}
                    name={def?.label ?? method}
                    data={points}
                    fill={color}
                    line={{ stroke: color, strokeWidth: lw, opacity: 0.95, strokeDasharray: dash }}
                    lineType="joint"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    shape={(props: any) => (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={1.5}
                        fill={color}
                        opacity={0.5}
                        style={{ cursor: 'default' }}
                      />
                    )}
                    isAnimationActive={false}
                  />
                )
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Summary stats table ── */}
      {hasAnyResults && (
        <div className="bg-card rounded-panel border border-border overflow-x-auto">
          <div className="px-4 pt-3 pb-2 border-b border-border">
            <p className="text-[10px] text-muted font-mono uppercase tracking-widest">
              Frontier Statistics Summary
            </p>
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-[#0b0f1a] text-muted border-b border-[#1a2035]">
                <th className="px-4 py-2 text-left">Method</th>
                <th className="px-4 py-2 text-right">#Pts</th>
                <th className="px-4 py-2 text-right">Min-Vol Ret</th>
                <th className="px-4 py-2 text-right">Min-Vol σ</th>
                <th className="px-4 py-2 text-right" style={{ color: '#10b981' }}>Max Sharpe</th>
                <th className="px-4 py-2 text-right" style={{ color: '#10b981' }}>Ret @ Sharpe</th>
                <th className="px-4 py-2 text-right" style={{ color: '#10b981' }}>σ @ Sharpe</th>
                <th className="px-4 py-2 text-right">Max Return</th>
              </tr>
            </thead>
            <tbody>
              {doneEntries.map(([method, state], i) => {
                const color = METHOD_COLORS[method] ?? '#8892a4'
                const def   = ALL_METHODS.find(m => m.id === method)
                const stats = computeStats(state.data!)
                if (!stats) return null
                return (
                  <tr
                    key={method}
                    className={`border-b border-[#1a2035] ${i % 2 === 0 ? 'bg-[#0b0f1a]/40' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[#c8d0e0] font-semibold">
                          {def?.label ?? method}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-muted">{stats.n}</td>
                    <td className="px-4 py-2 text-right text-[#00d4aa]">
                      {stats.minVol.ret.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right text-[#4f8ef7]">
                      {stats.minVol.vol.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-[#10b981]">
                      {stats.maxSharpe.sharpe.toFixed(3)}
                    </td>
                    <td className="px-4 py-2 text-right text-[#00d4aa]">
                      {stats.maxSharpe.ret.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right text-[#4f8ef7]">
                      {stats.maxSharpe.vol.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right text-[#c8d0e0]">
                      {stats.maxRet.ret.toFixed(2)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Max-Sharpe allocation comparison ─────────────────────────────── */}
      {hasAnyResults && doneEntries.length >= 1 && (() => {
        // Collect max-Sharpe weights per method
        const sharpePortfolios = doneEntries
          .map(([method, state]) => ({
            method,
            label: ALL_METHODS.find(m => m.id === method)?.label ?? method,
            color: METHOD_COLORS[method] ?? '#8892a4',
            pt:    maxSharpePortfolio(state.data!),
          }))
          .filter(x => x.pt !== null)

        if (!sharpePortfolios.length) return null

        // Union of all tickers
        const tickerSet = new Set<string>()
        sharpePortfolios.forEach(({ pt }) =>
          Object.keys(pt!.weights).forEach(t => tickerSet.add(t))
        )
        const tickers = Array.from(tickerSet).sort()

        // Build grouped bar data: one row per ticker
        const barData = tickers.map(ticker => {
          const row: Record<string, number | string> = { ticker }
          sharpePortfolios.forEach(({ method, pt }) => {
            row[method] = +((( pt!.weights[ticker] ?? 0) * 100).toFixed(2))
          })
          return row
        })

        // Weight table: rows = methods, cols = tickers
        return (
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-card rounded-panel border border-border overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted font-mono uppercase tracking-widest">
                    Max-Sharpe Portfolio — Allocation Comparison
                  </p>
                  <p className="text-[10px] text-muted font-mono mt-0.5 opacity-70">
                    Even when frontiers overlap, risk measures disagree on <em>which</em> portfolio is optimal
                  </p>
                </div>
              </div>

              {/* Grouped bar chart */}
              <div className="px-4 pb-4 pt-2">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={barData}
                    margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
                    barCategoryGap="25%"
                    barGap={2}
                  >
                    <CartesianGrid strokeDasharray="2 4" stroke={GRID_COLOR} vertical={false} />
                    <XAxis
                      dataKey="ticker"
                      tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
                      axisLine={{ stroke: GRID_COLOR }}
                      tickLine={false}
                    />
                    <YAxis
                      unit="%"
                      tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{
                        background: '#0d1117',
                        border: '1px solid rgba(56,189,248,0.2)',
                        borderRadius: 8,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 11,
                      }}
                      formatter={(value: number, name: string) => {
                        const def = ALL_METHODS.find(m => m.id === name)
                        return [`${value.toFixed(2)}%`, def?.label ?? name]
                      }}
                    />
                    {sharpePortfolios.map(({ method, color }) => (
                      <Bar key={method} dataKey={method} fill={color} opacity={0.85} radius={[2,2,0,0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>

                {/* Mini legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 justify-center">
                  {sharpePortfolios.map(({ method, label, color }) => (
                    <div key={method} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                      <span className="font-mono text-[10px] text-muted-bright">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Weight table — rows = methods, cols = tickers */}
            <div className="bg-card rounded-panel border border-border overflow-x-auto">
              <div className="px-4 pt-3 pb-2 border-b border-border">
                <p className="text-[10px] text-muted font-mono uppercase tracking-widest">
                  Weight Table — Max-Sharpe Portfolio per Method
                </p>
              </div>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-[#0b0f1a] text-muted border-b border-[#1a2035]">
                    <th className="px-4 py-2 text-left sticky left-0 bg-[#0b0f1a]">Method</th>
                    {tickers.map(t => (
                      <th key={t} className="px-3 py-2 text-right text-teal">{t}</th>
                    ))}
                    <th className="px-3 py-2 text-right text-[#10b981]">Sharpe</th>
                    <th className="px-3 py-2 text-right">Ret</th>
                    <th className="px-3 py-2 text-right text-[#4f8ef7]">Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {sharpePortfolios.map(({ method, label, color, pt }, i) => {
                    const sharpe = pt!.expected_volatility! > 0
                      ? (pt!.expected_return! / pt!.expected_volatility!).toFixed(3)
                      : '—'
                    return (
                      <tr key={method} className={`border-b border-[#1a2035] ${i % 2 === 0 ? 'bg-[#0b0f1a]/40' : ''}`}>
                        <td className="px-4 py-2 sticky left-0 bg-inherit">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-[#c8d0e0] font-semibold">{label}</span>
                          </div>
                        </td>
                        {tickers.map(t => {
                          const w = (pt!.weights[t] ?? 0) * 100
                          // Heatmap intensity: 0% = dark, 100% = bright
                          const intensity = Math.min(w / 50, 1)   // saturate at 50%
                          const bg = `rgba(37,99,235,${(intensity * 0.35).toFixed(2)})`
                          return (
                            <td
                              key={t}
                              className="px-3 py-2 text-right"
                              style={{ background: bg, color: w > 5 ? '#e8eaf0' : '#5a6a85' }}
                            >
                              {w > 0.05 ? `${w.toFixed(1)}%` : '—'}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-right font-bold text-[#10b981]">{sharpe}</td>
                        <td className="px-3 py-2 text-right text-[#00d4aa]">
                          {((pt!.expected_return! ?? 0) * 100).toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right text-[#4f8ef7]">
                          {((pt!.expected_volatility! ?? 0) * 100).toFixed(2)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Empty state */}
      {!hasAnyResults && !running && results.size === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted text-xs font-mono gap-2">
          <span>Select methods above and click <span className="text-[#2563eb]">Compare Frontiers</span></span>
          <span className="text-[10px] opacity-60">
            Each method traces its own risk-return curve — compare them side by side
          </span>
        </div>
      )}
    </div>
  )
}
