import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceDot, ResponsiveContainer,
} from 'recharts'
import type { FrontierResponse } from '../types'

const GRID_COLOR    = '#1e2530'
const AXIS_COLOR    = '#8892a4'
const ACCENT        = '#4f8ef7'
const MAX_SHARPE_C  = '#00d4aa'

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0d1117',
    border: '1px solid #1e2530',
    borderRadius: 6,
    fontSize: 11,
    fontFamily: '"JetBrains Mono", monospace',
  },
  labelStyle: { color: '#8892a4' },
}

interface ChartPoint { x: number; y: number; id: number }

interface Props { data: FrontierResponse }

export function FrontierChart({ data }: Props) {
  const sorted = [...data.portfolios]
    .filter(p => p.expected_volatility != null && p.expected_return != null)
    .sort((a, b) => a.expected_volatility! - b.expected_volatility!)

  const points: ChartPoint[] = sorted.map(p => ({
    x:  +((p.expected_volatility ?? 0) * 100).toFixed(3),
    y:  +((p.expected_return    ?? 0) * 100).toFixed(3),
    id: p.portfolio_id,
  }))

  // Max Sharpe point
  let maxSharpeI = 0
  let bestSharpe = -Infinity
  sorted.forEach((p, i) => {
    const s = (p.expected_return ?? 0) / (p.expected_volatility ?? 1)
    if (s > bestSharpe) { bestSharpe = s; maxSharpeI = i }
  })
  const msPoint = points[maxSharpeI]

  // Custom dot renderer
  const renderDot = (props: Record<string, unknown>) => {
    const { cx, cy, index } = props as { cx: number; cy: number; index: number }
    const isMax = index === maxSharpeI
    return (
      <circle
        key={index}
        cx={cx} cy={cy}
        r={isMax ? 0 : 3}
        fill={ACCENT}
        opacity={0.7}
      />
    )
  }

  return (
    <div className="bg-card rounded-panel p-4 border border-border">
      <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-1">
        Efficient Frontier
      </p>
      <p className="text-xs text-muted font-mono mb-4 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-[#00d4aa]" />
        Max Sharpe Ratio
        <span className="text-muted/50 mx-1">·</span>
        {points.length} portfolios
      </p>
      <ResponsiveContainer width="100%" height={360}>
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
            cursor={{ strokeDasharray: '3 3', stroke: ACCENT }}
            {...TOOLTIP_STYLE}
            formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]}
          />
          <Scatter
            data={points}
            line={{ stroke: ACCENT, strokeWidth: 1.8, opacity: 0.9 }}
            lineType="joint"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shape={renderDot as any}
            isAnimationActive={false}
          />
          {/* Max Sharpe highlighted dot via ReferenceDot */}
          {msPoint && (
            <ReferenceDot
              x={msPoint.x}
              y={msPoint.y}
              r={7}
              fill={MAX_SHARPE_C}
              stroke="#0d1117"
              strokeWidth={2}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
