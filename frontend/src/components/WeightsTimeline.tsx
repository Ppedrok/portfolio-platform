/**
 * WeightsTimeline.tsx
 * -------------------
 * Stacked area chart showing how portfolio weights evolve over time,
 * forward-filling rebalancing weights to all equity-curve dates.
 */

import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { BacktestResponse, TickerMatch } from '../types'

const TICKER_COLORS = [
  '#f59e0b', '#00d4aa', '#fb923c', '#a78bfa', '#f43f5e',
  '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#818cf8',
  '#4ade80', '#fb7185', '#38bdf8', '#facc15', '#c084fc',
  '#64748b', '#a3e635', '#e879f9',
]

const GRID = '#2a1e08'
const AXIS = '#7a6848'
const MONO = '"JetBrains Mono", monospace'

type ChartRow = Record<string, number | string>   // date + ticker weights

function buildTimeline(data: BacktestResponse, maxPoints = 200): ChartRow[] {
  const { equity_curve: ec, weights_history: wh } = data
  if (ec.length === 0 || wh.length === 0) return []

  // Sort rebalancing records by date (defensive)
  const sortedWh = [...wh].sort((a, b) => a.date.localeCompare(b.date))

  // Step size to keep at most maxPoints rows
  const step = Math.max(1, Math.floor(ec.length / maxPoints))

  let whIdx = 0
  let currentW = sortedWh[0].weights

  const result: ChartRow[] = []
  for (let i = 0; i < ec.length; i++) {
    const date = ec[i].date
    // Advance rebalancing pointer while the NEXT rebalancing date ≤ today
    while (
      whIdx + 1 < sortedWh.length &&
      sortedWh[whIdx + 1].date <= date
    ) {
      whIdx++
      currentW = sortedWh[whIdx].weights
    }

    if (i % step === 0 || i === ec.length - 1) {
      result.push({ date, ...currentW })
    }
  }
  return result
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function WeightsTooltip({
  active, payload, label,
}: {
  active?:  boolean
  payload?: { name: string; value: number; color: string }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null

  const sorted = [...payload].sort((a, b) => b.value - a.value)

  return (
    <div style={{
      background: '#0d1117', border: '1px solid #1e2530',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: MONO, fontSize: 11, minWidth: 180,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      maxHeight: 280, overflowY: 'auto',
    }}>
      <div style={{ color: '#f5f0e8', fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {sorted.map(({ name, value, color }) =>
        value > 0.005 ? (
          <div key={name} style={{
            display: 'flex', justifyContent: 'space-between',
            gap: 20, marginBottom: 3,
          }}>
            <span style={{ color }}>{name}</span>
            <span style={{ color: '#f5f0e8', fontWeight: 600 }}>
              {(value * 100).toFixed(1)}%
            </span>
          </div>
        ) : null,
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  data:   BacktestResponse
  assets?: TickerMatch[]
}

export function WeightsTimeline({ data }: Props) {
  const { chartData, tickers } = useMemo(() => {
    const rows    = buildTimeline(data)
    const tickers = data.tickers
    return { chartData: rows, tickers }
  }, [data])

  const tickInterval = Math.max(1, Math.floor(chartData.length / 12))

  if (chartData.length === 0) return null

  return (
    <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
      <p className="terminal-label mb-1">Portfolio Weights — Evolution Over Time</p>
      <p className="text-xs text-muted font-mono mb-4">
        Forward-filled from {data.rebalancing_steps} rebalancing dates
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={chartData}
          stackOffset="expand"
          margin={{ top: 4, right: 24, bottom: 24, left: 4 }}
        >
          <CartesianGrid strokeDasharray="2 4" stroke={GRID} />
          <XAxis
            dataKey="date"
            interval={tickInterval - 1}
            tick={{ fill: AXIS, fontSize: 9, fontFamily: MONO }}
            tickFormatter={(v: string) => v.slice(0, 7)}
            label={{ value: 'Date', position: 'insideBottom', offset: -10, fill: AXIS, fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: AXIS, fontSize: 10, fontFamily: MONO }}
            domain={[0, 1]}
            label={{ value: 'Weight', angle: -90, position: 'insideLeft', offset: 14, fill: AXIS, fontSize: 11 }}
          />
          <Tooltip content={<WeightsTooltip />} />
          <Legend
            iconType="rect"
            iconSize={8}
            formatter={(v: string) => (
              <span style={{ color: '#8892a4', fontSize: 10, fontFamily: MONO }}>{v}</span>
            )}
          />
          {tickers.map((ticker, idx) => (
            <Area
              key={ticker}
              type="monotone"
              dataKey={ticker}
              stackId="1"
              stroke={TICKER_COLORS[idx % TICKER_COLORS.length]}
              fill={TICKER_COLORS[idx % TICKER_COLORS.length]}
              fillOpacity={0.80}
              strokeWidth={0.5}
              dot={false}
              activeDot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
