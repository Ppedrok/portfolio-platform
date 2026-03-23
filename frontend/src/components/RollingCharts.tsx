/**
 * RollingCharts.tsx
 * -----------------
 * Two sub-charts shown below the equity curve in the backtest tab:
 *   1. Rolling 63-day Sharpe Ratio  (ComposedChart + Area fill)
 *   2. Drawdown series              (AreaChart, negative values)
 *
 * All computations are done client-side from the equity_curve array.
 */

import { useMemo } from 'react'
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { BacktestResponse } from '../types'

const ROLLING_WINDOW = 63

const GRID   = '#1a2035'
const AXIS   = '#5a6a85'
const MONO   = '"JetBrains Mono", monospace'

interface RollingPoint {
  date:     string
  sharpe:   number | null
  drawdown: number           // always ≤ 0
}

// ── Tooltip components ───────────────────────────────────────────────────────

function SharpeTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: { value: number | null }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? null
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #1e2530',
      borderRadius: 8, padding: '8px 12px',
      fontFamily: MONO, fontSize: 11, minWidth: 160,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#e8eaf0', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
        <span style={{ color: '#8892a4' }}>Rolling Sharpe</span>
        <span style={{
          color: v === null ? '#5a6a85' : v >= 1 ? '#00d4aa' : v < 0 ? '#f43f5e' : '#e8eaf0',
          fontWeight: 700,
        }}>
          {v !== null ? v.toFixed(2) : '—'}
        </span>
      </div>
    </div>
  )
}

function DrawdownTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: { value: number | null }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? null
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #1e2530',
      borderRadius: 8, padding: '8px 12px',
      fontFamily: MONO, fontSize: 11, minWidth: 160,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#e8eaf0', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
        <span style={{ color: '#8892a4' }}>Drawdown</span>
        <span style={{
          color: v !== null && v < -0.10 ? '#f43f5e' : '#e8eaf0',
          fontWeight: 700,
        }}>
          {v !== null ? `${(v * 100).toFixed(2)}%` : '—'}
        </span>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props { data: BacktestResponse }

export function RollingCharts({ data }: Props) {
  const { points, meanSharpe, maxDrawdown } = useMemo(() => {
    const ec = data.equity_curve
    if (ec.length === 0) return { points: [], meanSharpe: 0, maxDrawdown: 0 }

    // Daily returns
    const rets = ec.map((p, i) =>
      i === 0
        ? 0
        : (p.portfolio_value - ec[i - 1].portfolio_value) / ec[i - 1].portfolio_value,
    )

    let runMax = -Infinity
    const pts: RollingPoint[] = ec.map((p, i) => {
      const nav = p.portfolio_value
      if (nav > runMax) runMax = nav
      const drawdown = runMax > 0 ? (nav - runMax) / runMax : 0

      let sharpe: number | null = null
      if (i >= ROLLING_WINDOW - 1) {
        const win   = rets.slice(i - ROLLING_WINDOW + 1, i + 1)
        const mean  = win.reduce((s, r) => s + r, 0) / ROLLING_WINDOW
        const vari  = win.reduce((s, r) => s + (r - mean) ** 2, 0) / (ROLLING_WINDOW - 1)
        const std   = Math.sqrt(vari)
        sharpe = std > 1e-9 ? (mean * 252) / (std * Math.sqrt(252)) : null
      }

      return { date: p.date, sharpe, drawdown }
    })

    const sharpeVals = pts.map(p => p.sharpe).filter((v): v is number => v !== null)
    const avg        = sharpeVals.length > 0
      ? sharpeVals.reduce((s, v) => s + v, 0) / sharpeVals.length
      : 0

    const minDD = Math.min(...pts.map(p => p.drawdown))

    return { points: pts, meanSharpe: avg, maxDrawdown: minDD }
  }, [data])

  const tickInterval = Math.max(1, Math.floor(points.length / 12))
  const axisProps = {
    tick: { fill: AXIS, fontSize: 9, fontFamily: MONO },
    tickFormatter: (v: string) => v.slice(0, 7),
    interval: tickInterval - 1,
  }

  if (points.length === 0) return null

  return (
    <div className="space-y-3">

      {/* ── Rolling Sharpe ─────────────────────────────────────────────────── */}
      <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
        <p className="terminal-label mb-1">Rolling Sharpe Ratio
          <span className="text-muted font-mono font-normal ml-2">({ROLLING_WINDOW}-day)</span>
        </p>
        <p className="text-xs text-muted font-mono mb-4">
          Average:&nbsp;
          <span className={`font-semibold ${
            meanSharpe >= 1 ? 'text-positive' : meanSharpe < 0 ? 'text-negative' : 'text-[#c8d0e0]'
          }`}>
            {meanSharpe.toFixed(2)}
          </span>
        </p>

        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={points} margin={{ top: 4, right: 24, bottom: 16, left: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
            <ReferenceLine y={0} stroke="#3a4a5f" strokeWidth={1} />
            <ReferenceLine
              y={meanSharpe}
              stroke="#2563eb"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              label={{ value: `μ=${meanSharpe.toFixed(2)}`, position: 'right', fill: '#3b6fd4', fontSize: 9, fontFamily: MONO }}
            />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis
              tick={{ fill: AXIS, fontSize: 10, fontFamily: MONO }}
              tickFormatter={(v: number) => v.toFixed(1)}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<SharpeTooltip />} />
            {/* Positive fill */}
            <Area
              type="monotone"
              dataKey="sharpe"
              stroke="#2563eb"
              strokeWidth={1.5}
              fill="#2563eb"
              fillOpacity={0.12}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 3, fill: '#2563eb', stroke: '#0d1117', strokeWidth: 1 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Drawdown ────────────────────────────────────────────────────────── */}
      <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
        <p className="terminal-label mb-1">Drawdown</p>
        <p className="text-xs text-muted font-mono mb-4">
          Maximum:&nbsp;
          <span className="text-negative font-semibold">
            {(maxDrawdown * 100).toFixed(2)}%
          </span>
        </p>

        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={points} margin={{ top: 4, right: 24, bottom: 16, left: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
            <ReferenceLine y={0} stroke="#3a4a5f" strokeWidth={1} />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis
              tick={{ fill: AXIS, fontSize: 10, fontFamily: MONO }}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              domain={['auto', 0]}
            />
            <Tooltip content={<DrawdownTooltip />} />
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="#f43f5e"
              strokeWidth={1.5}
              fill="#f43f5e"
              fillOpacity={0.20}
              dot={false}
              activeDot={{ r: 3, fill: '#f43f5e', stroke: '#0d1117', strokeWidth: 1 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
