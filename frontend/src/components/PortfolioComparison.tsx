/**
 * PortfolioComparison.tsx
 * -----------------------
 * Comparison panel for saved portfolio backtest snapshots.
 *
 * Features:
 *  - Overlay equity curves (all snapshots on one chart, normalised to 1.0 at start)
 *  - Side-by-side metrics table
 *  - Final weights comparison bar chart
 *  - Delete individual snapshots
 */

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { PortfolioSnapshot } from '../types'

// ── Color palette ─────────────────────────────────────────────────────────────

const SNAPSHOT_COLORS = [
  '#f59e0b', '#00d4aa', '#fb923c', '#a78bfa',
  '#f43f5e', '#fbbf24', '#34d399', '#60a5fa',
]

const GRID = '#2a1e08'
const AXIS = '#7a6848'
const MONO = '"JetBrains Mono", monospace'

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

// ── Overlay equity chart ───────────────────────────────────────────────────────

function buildOverlayData(
  snapshots: PortfolioSnapshot[],
): Record<string, number | string>[] {
  if (snapshots.length === 0) return []

  // Collect all unique dates from all snapshots
  const dateSet = new Set<string>()
  for (const snap of snapshots) {
    for (const p of snap.equity_curve) dateSet.add(p.date)
  }
  const allDates = Array.from(dateSet).sort()

  // Subsample to ≤ 300 dates
  const step = Math.max(1, Math.floor(allDates.length / 300))
  const sampledDates = allDates.filter((_, i) => i % step === 0)

  // For each snapshot, build date→value map (normalised to start = 1)
  const maps: { id: string; map: Map<string, number>; startValue: number }[] = snapshots.map(snap => {
    const m = new Map<string, number>()
    for (const p of snap.equity_curve) m.set(p.date, p.portfolio_value)
    const startValue = snap.equity_curve[0]?.portfolio_value ?? 1
    return { id: snap.id, map: m, startValue }
  })

  return sampledDates.map(date => {
    const row: Record<string, number | string> = { date }
    for (const { id, map, startValue } of maps) {
      const raw = map.get(date)
      if (raw !== undefined) row[id] = raw / startValue   // normalise to 1
    }
    return row
  })
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function OverlayTooltip({
  active, payload, label, snapshots,
}: {
  active?:   boolean
  payload?:  { name: string; value: number; color: string }[]
  label?:    string
  snapshots: PortfolioSnapshot[]
}) {
  if (!active || !payload?.length) return null
  const labelMap = Object.fromEntries(snapshots.map(s => [s.id, s.label]))
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #1e2530',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: MONO, fontSize: 11, minWidth: 220,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#f5f0e8', fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {[...payload].sort((a, b) => b.value - a.value).map(p => (
        <div key={p.name} style={{
          display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 4,
        }}>
          <span style={{ color: p.color }}>{labelMap[p.name] ?? p.name}</span>
          <span style={{ color: '#f5f0e8', fontWeight: 700 }}>
            ×{p.value.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Metrics comparison table ──────────────────────────────────────────────────

const COMPARE_ROWS = [
  { key: 'Annualized Return',     label: 'Ann. Return',  pct: true,  inv: false, isRatio: false },
  { key: 'Annualized Volatility', label: 'Ann. Vol',     pct: true,  inv: false, isRatio: false },
  { key: 'Sharpe Ratio',          label: 'Sharpe',       pct: false, inv: false, isRatio: true  },
  { key: 'Sortino Ratio',         label: 'Sortino',      pct: false, inv: false, isRatio: true  },
  { key: 'Max Drawdown',          label: 'Max DD',       pct: true,  inv: true,  isRatio: false },
  { key: 'Calmar Ratio',          label: 'Calmar',       pct: false, inv: false, isRatio: false },
  { key: 'Win Rate',              label: 'Win Rate',     pct: true,  inv: false, isRatio: false },
]

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  snapshots:       PortfolioSnapshot[]
  onDelete:        (id: string) => void
  onClear:         () => void
}

export function PortfolioComparison({ snapshots, onDelete, onClear }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  const overlayData = useMemo(() => buildOverlayData(snapshots), [snapshots])
  const tickInterval = Math.max(1, Math.floor(overlayData.length / 12))

  // ── Empty state ─────────────────────────────────────────────────────────────
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
          Run a backtest, then click <strong className="text-[#f0e8d4]">Save Snapshot</strong> in the Backtest tab to compare strategies.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Snapshot list ──────────────────────────────────────────────────── */}
      <div className="bg-card rounded-panel border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="terminal-label">Saved Snapshots ({snapshots.length})</p>
          <button
            onClick={onClear}
            className="text-[10px] font-mono text-muted hover:text-negative transition-colors"
          >
            Clear all
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {snapshots.map((snap, idx) => {
            const ret = snap.metrics['Annualized Return']?.['Portfolio'] ?? null
            const sr  = snap.metrics['Sharpe Ratio']?.['Portfolio'] ?? null
            const color = SNAPSHOT_COLORS[idx % SNAPSHOT_COLORS.length]
            return (
              <div
                key={snap.id}
                className="flex items-center gap-3 rounded p-2.5 transition-colors"
                style={{ background: hovered === snap.id ? '#0d1117' : undefined }}
                onMouseEnter={() => setHovered(snap.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Color swatch */}
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: color }}
                />
                {/* Label & info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono font-semibold text-[#f0e8d4] truncate">
                    {snap.label}
                  </p>
                  <p className="text-[10px] font-mono text-muted mt-0.5">
                    {snap.oos_start} → {snap.oos_end} · {snap.tickers.length} assets
                  </p>
                </div>
                {/* Quick stats */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] font-mono text-muted uppercase">Return</p>
                    <p className={`text-[11px] font-mono font-semibold ${valColor(ret)}`}>
                      {fmt(ret, true)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-mono text-muted uppercase">Sharpe</p>
                    <p className={`text-[11px] font-mono font-semibold ${ratioColor(sr)}`}>
                      {fmt(sr, false)}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(snap.id)}
                    className="text-muted hover:text-negative transition-colors ml-1"
                    title="Remove snapshot"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6"  y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Overlay equity curve ────────────────────────────────────────────── */}
      {overlayData.length > 0 && (
        <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
          <p className="terminal-label mb-1">Equity Curves — Normalised to 1.0 at Start</p>
          <p className="text-xs text-muted font-mono mb-4">
            Each strategy indexed to 1.0 at its own OOS start date
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={overlayData} margin={{ top: 8, right: 24, bottom: 24, left: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
              <ReferenceLine y={1} stroke={GRID} strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                interval={tickInterval - 1}
                tick={{ fill: AXIS, fontSize: 9, fontFamily: MONO }}
                tickFormatter={(v: string) => v.slice(0, 7)}
                label={{ value: 'Date', position: 'insideBottom', offset: -10, fill: AXIS, fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: AXIS, fontSize: 10, fontFamily: MONO }}
                tickFormatter={(v: number) => `×${v.toFixed(2)}`}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<OverlayTooltip snapshots={snapshots} />} />
              <Legend
                iconType="line"
                formatter={(id: string) => {
                  const snap = snapshots.find(s => s.id === id)
                  return (
                    <span style={{ color: '#8892a4', fontSize: 10, fontFamily: MONO }}>
                      {snap?.label ?? id}
                    </span>
                  )
                }}
              />
              {snapshots.map((snap, idx) => (
                <Line
                  key={snap.id}
                  type="monotone"
                  dataKey={snap.id}
                  stroke={SNAPSHOT_COLORS[idx % SNAPSHOT_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4, stroke: '#0d1117', strokeWidth: 1 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Metrics comparison table ─────────────────────────────────────────── */}
      <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
        <p className="terminal-label mb-3">Metrics Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pl-1 text-left terminal-label">Metric</th>
                {snapshots.map((snap, idx) => (
                  <th key={snap.id} className="pb-2 pr-1 text-right terminal-label">
                    <span style={{ color: SNAPSHOT_COLORS[idx % SNAPSHOT_COLORS.length] }}>
                      {snap.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(({ key, label, pct, inv, isRatio }) => (
                <tr key={key} className="border-b border-border/40 hover:bg-card-raised transition-colors">
                  <td className="py-2 pl-1 text-muted font-mono">{label}</td>
                  {snapshots.map((snap) => {
                    const v = snap.metrics[key]?.['Portfolio'] ?? null
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

      {/* ── Final weights comparison ──────────────────────────────────────────── */}
      <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
        <p className="terminal-label mb-3">Final Weights Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pl-1 text-left terminal-label">Ticker</th>
                {snapshots.map((snap, idx) => (
                  <th key={snap.id} className="pb-2 pr-1 text-right terminal-label">
                    <span style={{ color: SNAPSHOT_COLORS[idx % SNAPSHOT_COLORS.length] }}>
                      {snap.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Collect all tickers across all snapshots */}
              {Array.from(
                new Set(snapshots.flatMap(s => Object.keys(s.finalWeights)))
              ).sort().map(ticker => (
                <tr key={ticker} className="border-b border-border/40 hover:bg-card-raised transition-colors">
                  <td className="py-1.5 pl-1 font-mono font-semibold text-[#f0e8d4]">{ticker}</td>
                  {snapshots.map((snap) => {
                    const w = snap.finalWeights[ticker] ?? 0
                    return (
                      <td key={snap.id} className="py-1.5 pr-1 text-right font-mono">
                        <div className="flex items-center justify-end gap-2">
                          {/* Mini bar */}
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.max(2, w * 80)}px`,
                              background: SNAPSHOT_COLORS[
                                snapshots.indexOf(snap) % SNAPSHOT_COLORS.length
                              ],
                              opacity: 0.7,
                            }}
                          />
                          <span className={w > 0 ? 'text-[#f0e8d4]' : 'text-muted'}>
                            {w > 0 ? `${(w * 100).toFixed(1)}%` : '—'}
                          </span>
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
