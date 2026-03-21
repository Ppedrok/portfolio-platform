import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { BacktestResponse } from '../types'

const GRID_COLOR  = '#1e2530'
const AXIS_COLOR  = '#8892a4'
const PORT_COLOR  = '#4f8ef7'
const BM_COLOR    = '#fb923c'

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0d1117',
    border: '1px solid #1e2530',
    borderRadius: 6,
    fontSize: 11,
    fontFamily: '"JetBrains Mono", monospace',
  },
  labelStyle: { color: '#8892a4', fontSize: 10 },
}

interface Props { data: BacktestResponse }

export function EquityCurve({ data }: Props) {
  const chartData = data.equity_curve.map(p => ({
    date:      p.date,
    Portfolio: +p.portfolio_value.toFixed(4),
    Benchmark: p.benchmark_value != null ? +p.benchmark_value.toFixed(4) : undefined,
  }))

  const tickInterval = Math.max(1, Math.floor(chartData.length / 14))

  return (
    <div className="bg-card rounded-panel p-4 border border-border">
      <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-1">
        Equity Curve
      </p>
      <p className="text-xs text-muted font-mono mb-4">
        <span className="text-[#e8eaf0]">{data.oos_start}</span>
        <span className="text-muted mx-1">→</span>
        <span className="text-[#e8eaf0]">{data.oos_end}</span>
        <span className="text-muted mx-2">·</span>
        {data.rebalancing_steps} rebalancings
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 24, left: 4 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={GRID_COLOR} />
          <ReferenceLine y={1} stroke={GRID_COLOR} strokeDasharray="4 4" />
          <XAxis
            dataKey="date"
            interval={tickInterval - 1}
            tick={{ fill: AXIS_COLOR, fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}
            tickFormatter={(v: string) => v.slice(0, 7)}
            label={{ value: 'Date', position: 'insideBottom', offset: -10, fill: AXIS_COLOR, fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
            tickFormatter={(v: number) => v.toFixed(2)}
            domain={['auto', 'auto']}
            label={{ value: 'NAV (base 1)', angle: -90, position: 'insideLeft', offset: 14, fill: AXIS_COLOR, fontSize: 11 }}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(v: number, name: string) => [`${v.toFixed(4)}`, name]}
          />
          <Legend
            iconType="line"
            formatter={(v: string) => (
              <span style={{ color: '#8892a4', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>{v}</span>
            )}
          />
          <Line
            type="monotone"
            dataKey="Portfolio"
            stroke={PORT_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: PORT_COLOR, stroke: '#0d1117', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="Benchmark"
            stroke={BM_COLOR}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 3, fill: BM_COLOR }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
