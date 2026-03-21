import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { BacktestResponse } from '../types'

interface Props {
  data: BacktestResponse
}

export function EquityCurve({ data }: Props) {
  const chartData = data.equity_curve.map(p => ({
    date:      p.date,
    Portfolio: +p.portfolio_value.toFixed(4),
    Benchmark: p.benchmark_value != null ? +p.benchmark_value.toFixed(4) : undefined,
  }))

  // Show ~14 x-axis labels
  const tickInterval = Math.max(1, Math.floor(chartData.length / 14))

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-white mb-1">Equity Curve</h3>
      <p className="text-xs text-muted mb-4">
        OOS period: <span className="text-white">{data.oos_start}</span> → <span className="text-white">{data.oos_end}</span>
        &nbsp;·&nbsp; {data.rebalancing_steps} rebalancings
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 10, right: 24, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis
            dataKey="date"
            interval={tickInterval - 1}
            tick={{ fill: '#8b8fa8', fontSize: 10 }}
            tickFormatter={(v: string) => v.slice(0, 7)}
            label={{ value: 'Date', position: 'insideBottom', offset: -10, fill: '#8b8fa8', fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: '#8b8fa8', fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(2)}
            domain={['auto', 'auto']}
            label={{ value: 'Value (base 1)', angle: -90, position: 'insideLeft', offset: 12, fill: '#8b8fa8', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: '#8b8fa8', fontSize: 11 }}
            formatter={(v: number, name: string) => [v.toFixed(4), name]}
          />
          <Legend
            iconType="line"
            formatter={(v: string) => <span style={{ color: '#8b8fa8', fontSize: 12 }}>{v}</span>}
          />
          <Line
            type="monotone"
            dataKey="Portfolio"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1' }}
          />
          <Line
            type="monotone"
            dataKey="Benchmark"
            stroke="#f97316"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 4, fill: '#f97316' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
