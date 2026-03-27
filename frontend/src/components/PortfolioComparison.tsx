/**
 * PortfolioComparison.tsx
 * -----------------------
 * Comparison panel for saved portfolio backtest snapshots.
 *
 * Features:
 *  - Overlay equity curves (all snapshots on one chart, normalised to 1.0 at start)
 *  - Side-by-side metrics table
 *  - Final weights comparison bar chart
 *  - Per-snapshot expandable drawer: full config + allocation over time
 *  - Delete individual snapshots
 */

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'
import type { PortfolioSnapshot } from '../types'

// ── Color palette ─────────────────────────────────────────────────────────────

const SNAPSHOT_COLORS = [
  '#f59e0b', '#00d4aa', '#fb923c', '#a78bfa',
  '#f43f5e', '#fbbf24', '#34d399', '#60a5fa',
]

const PIE_COLORS = [
  '#f59e0b','#fb923c','#fbbf24','#f97316',
  '#00d4aa','#34d399','#60a5fa','#a78bfa',
  '#f43f5e','#e879f9','#818cf8','#38bdf8',
]

const GRID = '#2a1e08'
const AXIS = '#7a6848'
const MONO = '"JetBrains Mono", monospace'
const BG   = '#070504'

// ── Utility ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, pct: boolean): string {
  if (v == null) return '—'
  return pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(3)
}

function ratioColor(v: number | null | undefined): string {
  if (v == null) return 'text-[#f0e8d4]'
  if (v >= 1) return 'text-positive'
  if (v < 0.5) return 'text-warning'
  return 'text-[#f0e8d4]'
}

function valColor(v: number | null | undefined, invert = false): string {
  if (v == null) return 'text-[#f0e8d4]'
  const pos = invert ? v < 0 : v > 0
  return pos ? 'text-positive' : 'text-negative'
}

function methodLabel(key: string): string {
  const MAP: Record<string, string> = {
    historical: 'Historical',
    capm: 'CAPM',
    black_litterman: 'Black-Litterman',
    shrinkage: 'Shrinkage',
    sample: 'Sample',
    ledoit_wolf: 'Ledoit-Wolf',
    oracle: 'Oracle Approx.',
    markowitz: 'Mean-Variance',
    CVaR: 'CVaR', EVaR: 'EVaR',
    MAD: 'MAD', SMAD: 'SMAD', GMD: 'GMD',
    SemiVariance: 'Semi-Variance',
    LPM: 'Lower Part. Moments',
    UCI: 'Ulcer Index',
    Brownian: 'Brownian Motion',
    TE_L2: 'TE (L2)', TE_L1: 'TE (L1)', TE_Cov: 'TE (Cov)',
  }
  return MAP[key] ?? key
}

// ── Chevron ───────────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ── Config badge ──────────────────────────────────────────────────────────────

function ConfigBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      background: '#0d0a04', border: '1px solid #2a1e08',
      borderRadius: 6, padding: '6px 10px',
    }}>
      <span style={{ color: '#7a6848', fontSize: 9, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ color: '#f0e8d4', fontSize: 11, fontFamily: MONO, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}

// ── Allocation pie ────────────────────────────────────────────────────────────

function AllocationPie({ weights, color }: { weights: Record<string, number>; color: string }) {
  const data = Object.entries(weights)
    .filter(([, v]) => v > 0.001)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value], i) => ({ name, value, fill: PIE_COLORS[i % PIE_COLORS.length] }))

  if (data.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <PieChart width={120} height={120}>
        <Pie data={data} cx={55} cy={55} innerRadius={28} outerRadius={52} paddingAngle={2} dataKey="value">
          {data.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
        </Pie>
        <Tooltip
          formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, '']}
          contentStyle={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 6, fontSize: 10, fontFamily: MONO }}
        />
      </PieChart>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontFamily: MONO, color: '#f0e8d4' }}>{d.name}</span>
            <span style={{ fontSize: 10, fontFamily: MONO, color, marginLeft: 8, fontWeight: 700 }}>
              {(d.value * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Weights over time ─────────────────────────────────────────────────────────

function WeightsOverTime({ weightsHistory }: { weightsHistory: { date: string; weights: Record<string, number> }[] }) {
  const [hov, setHov] = useState<string | null>(null)
  if (!weightsHistory || weightsHistory.length < 2) return null

  const tickers = Array.from(new Set(weightsHistory.flatMap(r => Object.keys(r.weights)))).sort()
  const step    = Math.max(1, Math.floor(weightsHistory.length / 80))
  const sampled = weightsHistory.filter((_, i) => i % step === 0)
  const data    = sampled.map(r => ({ date: r.date, ...Object.fromEntries(tickers.map(t => [t, (r.weights[t] ?? 0) * 100])) }))

  return (
    <div>
      <p style={{ fontSize: 10, fontFamily: MONO, color: '#7a6848', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Allocation Over Time
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 20, left: 0 }} barSize={8}>
          <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
          <XAxis dataKey="date" tick={{ fill: AXIS, fontSize: 8, fontFamily: MONO }} interval={Math.floor(data.length / 6)} tickFormatter={(v: string) => v.slice(0, 7)} />
          <YAxis tick={{ fill: AXIS, fontSize: 8, fontFamily: MONO }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} domain={[0, 100]} />
          <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]} contentStyle={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 6, fontSize: 10, fontFamily: MONO }} />
          {tickers.map((t, i) => (
            <Bar key={t} dataKey={t} stackId="a" fill={PIE_COLORS[i % PIE_COLORS.length]}
              opacity={hov && hov !== t ? 0.35 : 1}
              onMouseEnter={() => setHov(t)} onMouseLeave={() => setHov(null)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Snapshot detail drawer ────────────────────────────────────────────────────

function SnapshotDetail({ snap, color }: { snap: PortfolioSnapshot; color: string }) {
  const cfg = snap.config

  return (
    <div style={{ borderTop: '1px solid #2a1e08', background: '#0a0703', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Config */}
      {cfg && (
        <div>
          <p style={{ fontSize: 10, fontFamily: MONO, color: '#7a6848', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Run Configuration
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <ConfigBadge label="Data Period"   value={`${cfg.trainStart} → ${cfg.trainEnd}`} />
            <ConfigBadge label="OOS Period"    value={`${snap.oos_start} → ${snap.oos_end}`} />
            <ConfigBadge label="Opt. Method"   value={methodLabel(cfg.optMethod)} />
            <ConfigBadge label="μ Estimation"  value={methodLabel(cfg.muMethod)} />
            <ConfigBadge label="Σ Estimation"  value={methodLabel(cfg.covMethod)} />
            <ConfigBadge label="Est. Window"   value={`${cfg.estimationWindow}d`} />
            <ConfigBadge label="Rebal. Freq"   value={`${cfg.rebalancingFreq}d`} />
            <ConfigBadge label="Long Only"     value={cfg.longOnly ? 'Yes' : 'No'} />
            <ConfigBadge label="Min Weight"    value={`${(cfg.minWeight * 100).toFixed(0)}%`} />
            <ConfigBadge label="Max Weight"    value={`${(cfg.maxWeight * 100).toFixed(0)}%`} />
            {cfg.benchmarkTicker && <ConfigBadge label="Benchmark" value={cfg.benchmarkTicker} />}
            {cfg.maxTrackingError != null && <ConfigBadge label="Max TE" value={`${(cfg.maxTrackingError * 100).toFixed(1)}%`} />}
            <ConfigBadge label="Solver" value={cfg.solver} />
            <ConfigBadge label="Assets" value={snap.tickers.join(', ')} />
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid #2a1e08' }} />

      {/* Allocation section */}
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <p style={{ fontSize: 10, fontFamily: MONO, color: '#7a6848', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Final Allocation
          </p>
          <AllocationPie weights={snap.finalWeights} color={color} />
        </div>
        {snap.weightsHistory && snap.weightsHistory.length > 1 && (
          <div style={{ flex: '2 1 300px' }}>
            <WeightsOverTime weightsHistory={snap.weightsHistory} />
          </div>
        )}
      </div>

      {/* Full metrics grid */}
      <div style={{ borderTop: '1px solid #2a1e08', paddingTop: 16 }}>
        <p style={{ fontSize: 10, fontFamily: MONO, color: '#7a6848', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Full Metrics
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 6 }}>
          {Object.entries(snap.metrics).map(([name, portMap]) => {
            const v      = portMap['Portfolio'] ?? null
            const bench  = portMap['Benchmark']  ?? null
            const isPct  = /return|volatility|drawdown|win/i.test(name)
            const isNeg  = /drawdown/i.test(name)
            const cls    = typeof v === 'number'
              ? (isNeg ? (v < 0 ? 'text-positive' : 'text-negative') : (v > 0 ? 'text-positive' : 'text-negative'))
              : 'text-[#f0e8d4]'
            return (
              <div key={name} style={{ background: '#0d0a04', border: '1px solid #2a1e08', borderRadius: 6, padding: '6px 10px' }}>
                <p style={{ fontSize: 9, fontFamily: MONO, color: '#7a6848', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{name}</p>
                <p className={`text-sm font-mono font-semibold mt-0.5 ${cls}`}>{fmt(v, isPct)}</p>
                {bench != null && (
                  <p style={{ fontSize: 9, fontFamily: MONO, color: '#7a6848', marginTop: 2 }}>
                    Bench: {fmt(bench, isPct)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ── Overlay chart ─────────────────────────────────────────────────────────────

function buildOverlayData(snapshots: PortfolioSnapshot[]) {
  if (snapshots.length === 0) return []
  const dateSet = new Set<string>()
  for (const s of snapshots) for (const p of s.equity_curve) dateSet.add(p.date)
  const allDates = Array.from(dateSet).sort()
  const step     = Math.max(1, Math.floor(allDates.length / 300))
  const sampled  = allDates.filter((_, i) => i % step === 0)
  const maps     = snapshots.map(s => {
    const m = new Map<string, number>()
    for (const p of s.equity_curve) m.set(p.date, p.portfolio_value)
    return { id: s.id, m, start: s.equity_curve[0]?.portfolio_value ?? 1 }
  })
  return sampled.map(date => {
    const row: Record<string, number | string> = { date }
    for (const { id, m, start } of maps) { const v = m.get(date); if (v !== undefined) row[id] = v / start }
    return row
  })
}

function OverlayTooltip({ active, payload, label, snapshots }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]
  label?: string; snapshots: PortfolioSnapshot[]
}) {
  if (!active || !payload?.length) return null
  const lm = Object.fromEntries(snapshots.map(s => [s.id, s.label]))
  return (
    <div style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 8, padding: '10px 14px', fontFamily: MONO, fontSize: 11, minWidth: 220, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
      <div style={{ color: '#f5f0e8', fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {[...payload].sort((a, b) => b.value - a.value).map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 4 }}>
          <span style={{ color: p.color }}>{lm[p.name] ?? p.name}</span>
          <span style={{ color: '#f5f0e8', fontWeight: 700 }}>×{p.value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Metrics rows ──────────────────────────────────────────────────────────────

const COMPARE_ROWS = [
  { key: 'Annualized Return',     label: 'Ann. Return', pct: true,  inv: false, isRatio: false },
  { key: 'Annualized Volatility', label: 'Ann. Vol',    pct: true,  inv: false, isRatio: false },
  { key: 'Sharpe Ratio',          label: 'Sharpe',      pct: false, inv: false, isRatio: true  },
  { key: 'Sortino Ratio',         label: 'Sortino',     pct: false, inv: false, isRatio: true  },
  { key: 'Max Drawdown',          label: 'Max DD',      pct: true,  inv: true,  isRatio: false },
  { key: 'Calmar Ratio',          label: 'Calmar',      pct: false, inv: false, isRatio: false },
  { key: 'Win Rate',              label: 'Win Rate',    pct: true,  inv: false, isRatio: false },
]

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  snapshots: PortfolioSnapshot[]
  onDelete:  (id: string) => void
  onClear:   () => void
}

export function PortfolioComparison({ snapshots, onDelete, onClear }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hovered,    setHovered]    = useState<string | null>(null)

  const overlayData  = useMemo(() => buildOverlayData(snapshots), [snapshots])
  const tickInterval = Math.max(1, Math.floor(overlayData.length / 12))

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center mb-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7a6848" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p className="text-[#f0e8d4] text-sm font-semibold mb-1">No snapshots saved</p>
        <p className="text-muted text-xs font-mono">
          Run a backtest, then click <strong className="text-[#f0e8d4]">Save Snapshot</strong> to compare strategies.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Snapshot list ─────────────────────────────────────────────────── */}
      <div className="bg-card rounded-panel border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <p className="terminal-label">Saved Snapshots ({snapshots.length})</p>
          <button onClick={onClear} className="text-[10px] font-mono text-muted hover:text-negative transition-colors">
            Clear all
          </button>
        </div>

        {snapshots.map((snap, idx) => {
          const ret      = snap.metrics['Annualized Return']?.['Portfolio'] ?? null
          const sr       = snap.metrics['Sharpe Ratio']?.['Portfolio'] ?? null
          const mdd      = snap.metrics['Max Drawdown']?.['Portfolio'] ?? null
          const color    = SNAPSHOT_COLORS[idx % SNAPSHOT_COLORS.length]
          const isOpen   = expandedId === snap.id

          return (
            <div key={snap.id} style={{ borderTop: '1px solid #2a1e08' }}>

              {/* Row header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none"
                style={{ background: hovered === snap.id && !isOpen ? '#140f04' : isOpen ? '#0d0a04' : undefined }}
                onMouseEnter={() => setHovered(snap.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setExpandedId(isOpen ? null : snap.id)}
              >
                {/* Color dot */}
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />

                {/* Label + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono font-semibold text-[#f0e8d4] truncate">{snap.label}</p>
                  <p className="text-[10px] font-mono text-muted mt-0.5">
                    OOS {snap.oos_start} → {snap.oos_end}
                    {snap.config && (
                      <span className="ml-2 opacity-70">
                        · {snap.config.estimationWindow}d / {snap.config.rebalancingFreq}d
                        · {snap.tickers.length} assets
                      </span>
                    )}
                  </p>
                </div>

                {/* Quick stats */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] font-mono text-muted uppercase">Return</p>
                    <p className={`text-[11px] font-mono font-semibold ${valColor(ret)}`}>{fmt(ret, true)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-mono text-muted uppercase">Sharpe</p>
                    <p className={`text-[11px] font-mono font-semibold ${ratioColor(sr)}`}>{fmt(sr, false)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-mono text-muted uppercase">Max DD</p>
                    <p className="text-[11px] font-mono font-semibold text-negative">{fmt(mdd, true)}</p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-muted" title={isOpen ? 'Collapse' : 'Show config & allocation'}>
                    <Chevron open={isOpen} />
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(snap.id) }}
                    className="text-muted hover:text-negative transition-colors"
                    title="Remove"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded drawer */}
              {isOpen && <SnapshotDetail snap={snap} color={color} />}

            </div>
          )
        })}
      </div>

      {/* ── Overlay equity curves ──────────────────────────────────────────── */}
      {overlayData.length > 0 && (
        <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
          <p className="terminal-label mb-1">Equity Curves — Normalised to 1.0</p>
          <p className="text-xs text-muted font-mono mb-4">Each strategy indexed to 1.0 at its OOS start date</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={overlayData} margin={{ top: 8, right: 24, bottom: 24, left: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
              <ReferenceLine y={1} stroke={GRID} strokeDasharray="4 4" />
              <XAxis dataKey="date" interval={tickInterval - 1} tick={{ fill: AXIS, fontSize: 9, fontFamily: MONO }} tickFormatter={(v: string) => v.slice(0, 7)} label={{ value: 'Date', position: 'insideBottom', offset: -10, fill: AXIS, fontSize: 11 }} />
              <YAxis tick={{ fill: AXIS, fontSize: 10, fontFamily: MONO }} tickFormatter={(v: number) => `×${v.toFixed(2)}`} domain={['auto', 'auto']} />
              <Tooltip content={<OverlayTooltip snapshots={snapshots} />} />
              <Legend iconType="line" formatter={(id: string) => {
                const s = snapshots.find(x => x.id === id)
                return <span style={{ color: '#8892a4', fontSize: 10, fontFamily: MONO }}>{s?.label ?? id}</span>
              }} />
              {snapshots.map((snap, idx) => (
                <Line key={snap.id} type="monotone" dataKey={snap.id}
                  stroke={SNAPSHOT_COLORS[idx % SNAPSHOT_COLORS.length]}
                  strokeWidth={2} dot={false} connectNulls
                  activeDot={{ r: 4, stroke: BG, strokeWidth: 1 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Metrics comparison ─────────────────────────────────────────────── */}
      <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
        <p className="terminal-label mb-3">Metrics Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pl-1 text-left terminal-label">Metric</th>
                {snapshots.map((snap, idx) => (
                  <th key={snap.id} className="pb-2 pr-1 text-right terminal-label">
                    <span style={{ color: SNAPSHOT_COLORS[idx % SNAPSHOT_COLORS.length] }}>{snap.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(({ key, label, pct, inv, isRatio }) => (
                <tr key={key} className="border-b border-border/40 hover:bg-card-raised transition-colors">
                  <td className="py-2 pl-1 text-muted font-mono">{label}</td>
                  {snapshots.map(snap => {
                    const v   = snap.metrics[key]?.['Portfolio'] ?? null
                    const cls = isRatio ? ratioColor(v) : valColor(v, inv)
                    return (
                      <td key={snap.id} className={`py-2 pr-1 text-right font-mono font-medium num ${cls}`}>
                        {fmt(v, pct)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Final weights comparison ──────────────────────────────────────── */}
      <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
        <p className="terminal-label mb-3">Final Weights Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pl-1 text-left terminal-label">Ticker</th>
                {snapshots.map((snap, idx) => (
                  <th key={snap.id} className="pb-2 pr-1 text-right terminal-label">
                    <span style={{ color: SNAPSHOT_COLORS[idx % SNAPSHOT_COLORS.length] }}>{snap.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(snapshots.flatMap(s => Object.keys(s.finalWeights)))).sort().map(ticker => (
                <tr key={ticker} className="border-b border-border/40 hover:bg-card-raised transition-colors">
                  <td className="py-1.5 pl-1 font-mono font-semibold text-[#f0e8d4]">{ticker}</td>
                  {snapshots.map((snap, si) => {
                    const w = snap.finalWeights[ticker] ?? 0
                    return (
                      <td key={snap.id} className="py-1.5 pr-1 text-right font-mono">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, w * 80)}px`, background: SNAPSHOT_COLORS[si % SNAPSHOT_COLORS.length], opacity: 0.7 }} />
                          <span className={w > 0 ? 'text-[#f0e8d4]' : 'text-muted'}>{w > 0 ? `${(w * 100).toFixed(1)}%` : '—'}</span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
