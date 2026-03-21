import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { FrontierResponse } from '../types'

interface ChartPoint {
  x:   number
  y:   number
  id:  number
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 10, fontSize: 12 },
  labelStyle:   { color: '#8b8fa8' },
}

interface Props {
  data: FrontierResponse
}

export function FrontierChart({ data }: Props) {
  // Sort by volatility for a clean left-to-right curve
  const sorted = [...data.portfolios]
    .filter(p => p.expected_volatility != null && p.expected_return != null)
    .sort((a, b) => a.expected_volatility! - b.expected_volatility!)

  const points: ChartPoint[] = sorted.map(p => ({
    x:  +((p.expected_volatility ?? 0) * 100).toFixed(3),
    y:  +((p.expected_return    ?? 0) * 100).toFixed(3),
    id: p.portfolio_id,
  }))

  // Max Sharpe index (after sort)
  let maxSharpeI = 0
  let bestSharpe = -Infinity
  sorted.forEach((p, i) => {
    const s = (p.expected_return ?? 0) / (p.expected_volatility ?? 1)
    if (s > bestSharpe) { bestSharpe = s; maxSharpeI = i }
  })

  // Custom dot: orange + bigger for max Sharpe
  const renderDot = (props: Record<string, unknown>) => {
    const { cx, cy, index } = props as { cx: number; cy: number; index: number }
    const isMax = index === maxSharpeI
    return (
      <circle
        key={index}
        cx={cx} cy={cy}
        r={isMax ? 7 : 4}
        fill={isMax ? '#f97316' : '#6366f1'}
        stroke={isMax ? '#fff' : 'none'}
        strokeWidth={isMax ? 2 : 0}
      />
    )
  }

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-white mb-1">Efficient Frontier</h3>
      <p className="text-xs text-muted mb-4">
        <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1.5 align-middle" />
        Max Sharpe Ratio &nbsp;·&nbsp; {points.length} portfolios
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 10, right: 24, bottom: 36, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            type="number"
            dataKey="x"
            name="Volatility"
            unit="%"
            tick={{ fill: '#8b8fa8', fontSize: 11 }}
            label={{ value: 'Expected Volatility (%)', position: 'insideBottom', offset: -20, fill: '#8b8fa8', fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Return"
            unit="%"
            tick={{ fill: '#8b8fa8', fontSize: 11 }}
            label={{ value: 'Expected Return (%)', angle: -90, position: 'insideLeft', offset: 12, fill: '#8b8fa8', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: '#6366f1' }}
            {...TOOLTIP_STYLE}
            formatter={(v: number, name: string) => [`${(v as number).toFixed(2)}%`, name]}
          />
          <Scatter
            data={points}
            line={{ stroke: '#6366f1', strokeWidth: 1.5 }}
            lineType="joint"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shape={renderDot as any}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
