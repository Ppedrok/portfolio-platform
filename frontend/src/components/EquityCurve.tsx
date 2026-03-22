import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { BacktestResponse } from '../types'

const GRID_COLOR  = '#1a2035'
const AXIS_COLOR  = '#5a6a85'
const PORT_COLOR  = '#2563eb'
const BM_COLOR    = '#fb923c'

const TOOLTIP_ROW: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 3,
}

interface ChartRow {
  date:        string
  Portfolio:   number
  Benchmark?:  number
  dailyReturn: number
  drawdown:    number
}

function EquityTooltip({
  active, payload, label,
}: {
  active?:  boolean
  payload?: { name: string; value: number; color: string; payload: ChartRow }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  const row  = payload[0].payload
  const port = payload.find(p => p.name === 'Portfolio')
  const bm   = payload.find(p => p.name === 'Benchmark')
  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #1e2530',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11,
      minWidth: 200,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#e8eaf0', fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {port && (
        <div style={TOOLTIP_ROW}>
          <span style={{ color: '#8892a4' }}>Portfolio</span>
          <span style={{ color: PORT_COLOR, fontWeight: 700 }}>
            ${(port.value * 1000).toFixed(2)}
          </span>
        </div>
      )}
      {bm && bm.value !== undefined && (
        <div style={TOOLTIP_ROW}>
          <span style={{ color: '#8892a4' }}>Benchmark</span>
          <span style={{ color: BM_COLOR, fontWeight: 700 }}>
            ${(bm.value * 1000).toFixed(2)}
          </span>
        </div>
      )}
      <div style={{ borderTop: '1px solid #1e2530', paddingTop: 6, marginTop: 4 }}>
        <div style={TOOLTIP_ROW}>
          <span style={{ color: '#8892a4' }}>Daily Return</span>
          <span style={{ color: row.dailyReturn >= 0 ? '#00d4aa' : '#f43f5e', fontWeight: 700 }}>
            {row.dailyReturn >= 0 ? '+' : ''}{(row.dailyReturn * 100).toFixed(2)}%
          </span>
        </div>
        <div style={{ ...TOOLTIP_ROW, marginBottom: 0 }}>
          <span style={{ color: '#8892a4' }}>Drawdown</span>
          <span style={{ color: row.drawdown < -0.05 ? '#f43f5e' : '#e8eaf0', fontWeight: 700 }}>
            {(row.drawdown * 100).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  )
}

interface Props { data: BacktestResponse }

export function EquityCurve({ data }: Props) {
  let runningPeak = -Infinity
  const chartData: ChartRow[] = data.equity_curve.map((p, i) => {
    const nav     = +p.portfolio_value.toFixed(4)
    const prevNav = i > 0 ? +data.equity_curve[i - 1].portfolio_value.toFixed(4) : nav
    const dailyReturn = i > 0 ? (nav - prevNav) / prevNav : 0
    if (nav > runningPeak) runningPeak = nav
    const drawdown = runningPeak > 0 ? (nav - runningPeak) / runningPeak : 0
    return {
      date:      p.date,
      Portfolio: nav,
      Benchmark: p.benchmark_value != null ? +p.benchmark_value.toFixed(4) : undefined,
      dailyReturn,
      drawdown,
    }
  })

  const tickInterval = Math.max(1, Math.floor(chartData.length / 14))

  return (
    <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
      <p className="terminal-label mb-1">Equity Curve</p>
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
          <Tooltip content={<EquityTooltip />} />
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
