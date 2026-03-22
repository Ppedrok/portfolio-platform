import { useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceDot, ResponsiveContainer,
  AreaChart, Area, Legend,
} from 'recharts'
import type { FrontierResponse } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = [
  '#4f8ef7', '#00d4aa', '#f59e0b', '#f43f5e', '#a78bfa',
  '#34d399', '#fb923c', '#38bdf8', '#e879f9', '#facc15',
]
const GRID_COLOR   = '#1e2530'
const AXIS_COLOR   = '#8892a4'
const ACCENT       = '#4f8ef7'
const MAX_SHARPE_C = '#00d4aa'
const SELECTED_C   = '#f59e0b'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChartPoint { x: number; y: number; id: number; idx: number; weights: Record<string, number> }
interface Props { data: FrontierResponse }

// ── Custom tooltips ───────────────────────────────────────────────────────────

const TOOLTIP_ROW: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 3,
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: ChartPoint }[]
}) {
  if (!active || !payload?.length) return null
  const pt = payload[0].payload
  const sharpe = pt.x > 0 ? (pt.y / pt.x) : 0

  const top3 = Object.entries(pt.weights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([ticker, w]) => `${ticker} ${(w * 100).toFixed(0)}%`)
    .join(' · ')

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid rgba(56,189,248,0.3)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11,
      minWidth: 200,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#8892a4', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Portfolio #{pt.id}
      </div>
      <div style={TOOLTIP_ROW}>
        <span style={{ color: '#8892a4' }}>Expected Return</span>
        <span style={{ color: '#00d4aa', fontWeight: 700 }}>{pt.y.toFixed(2)}%</span>
      </div>
      <div style={TOOLTIP_ROW}>
        <span style={{ color: '#8892a4' }}>Volatility</span>
        <span style={{ color: '#4f8ef7', fontWeight: 700 }}>{pt.x.toFixed(2)}%</span>
      </div>
      <div style={{ ...TOOLTIP_ROW, marginBottom: 6 }}>
        <span style={{ color: '#8892a4' }}>Sharpe Ratio</span>
        <span style={{ color: '#f59e0b', fontWeight: 700 }}>{sharpe.toFixed(3)}</span>
      </div>
      <div style={{ borderTop: '1px solid #1e2530', paddingTop: 6, color: '#8892a4', fontSize: 9, lineHeight: 1.6 }}>
        {top3}
      </div>
      <div style={{ color: '#8892a4', fontSize: 8, marginTop: 4, opacity: 0.6 }}>click to inspect composition</div>
    </div>
  )
}

function AreaTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid rgba(79,142,247,0.4)',
      borderRadius: 6,
      padding: '8px 12px',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 10,
      maxWidth: 200,
    }}>
      <div style={{ color: '#8892a4', fontSize: 9, marginBottom: 4 }}>
        Vol: {label}%
      </div>
      {[...payload].reverse().map(p => (
        <div
          key={p.dataKey}
          style={{ color: p.fill, display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 2 }}
        >
          <span>{p.dataKey}</span>
          <span style={{ fontWeight: 700 }}>{(p.value as number).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

// ── Mini weights legend (no pie) ──────────────────────────────────────────────

function MiniWeights({
  weights,
  tickers,
}: {
  weights: Record<string, number>
  tickers: string[]
}) {
  const items = tickers
    .map((t, i) => ({
      name:  t,
      value: Math.round((weights[t] ?? 0) * 10000) / 100,
      color: COLORS[i % COLORS.length],
    }))
    .filter(d => d.value > 0.1)
    .sort((a, b) => b.value - a.value)

  const maxVal = items[0]?.value ?? 100

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
      {items.map(item => (
        <div key={item.name}>
          <div className="flex items-center gap-2 mb-0.5">
            <div
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-mono font-semibold text-accent text-[10px] flex-1 truncate">
              {item.name}
            </span>
            <span
              className="font-mono font-semibold text-[10px] shrink-0"
              style={{ color: item.value > 20 ? '#00d4aa' : '#e8eaf0' }}
            >
              {item.value.toFixed(1)}%
            </span>
          </div>
          <div
            className="h-[3px] w-full rounded-full"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.value / maxVal) * 100}%`,
                backgroundColor: item.color,
                opacity: 0.75,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function FrontierChart({ data }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const tickers = data.tickers

  const sorted = [...data.portfolios]
    .filter(p => p.expected_volatility != null && p.expected_return != null)
    .sort((a, b) => a.expected_volatility! - b.expected_volatility!)

  const points: ChartPoint[] = sorted.map((p, i) => ({
    x:       +((p.expected_volatility ?? 0) * 100).toFixed(3),
    y:       +((p.expected_return    ?? 0) * 100).toFixed(3),
    id:      p.portfolio_id,
    idx:     i,
    weights: p.weights,
  }))

  // Max Sharpe point
  let maxSharpeI = 0
  let bestSharpe = -Infinity
  sorted.forEach((p, i) => {
    const s = (p.expected_return ?? 0) / (p.expected_volatility ?? 1)
    if (s > bestSharpe) { bestSharpe = s; maxSharpeI = i }
  })
  const msPoint  = points[maxSharpeI]
  const selPoint = selectedIdx !== null ? points[selectedIdx] : null

  // Area chart data
  const areaData = sorted.map(p => ({
    volatility: ((p.expected_volatility ?? 0) * 100).toFixed(2),
    ...tickers.reduce<Record<string, number>>((acc, t) => {
      acc[t] = parseFloat(((p.weights[t] ?? 0) * 100).toFixed(2))
      return acc
    }, {}),
  }))

  // Custom dot renderer (hides dots that are shown via ReferenceDot)
  const renderDot = (props: Record<string, unknown>) => {
    const { cx, cy, index } = props as { cx: number; cy: number; index: number }
    const hidden = index === maxSharpeI || index === selectedIdx
    return (
      <circle
        key={index}
        cx={cx}
        cy={cy}
        r={hidden ? 0 : 3}
        fill={ACCENT}
        opacity={0.7}
        style={{ cursor: 'pointer' }}
      />
    )
  }

  const handleScatterClick = (point: ChartPoint) => {
    setSelectedIdx(prev => prev === point.idx ? null : point.idx)
  }

  const selPortfolio = selectedIdx !== null ? sorted[selectedIdx] : null

  return (
    <div className="bg-card rounded-panel p-4 border border-border space-y-6">

      {/* ── Scatter: Efficient Frontier ── */}
      <div>
        <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-1">
          Efficient Frontier
        </p>
        <p className="text-xs text-muted font-mono mb-4 flex items-center gap-1.5 flex-wrap">
          <span className="inline-block w-2 h-2 rounded-full bg-[#00d4aa]" />
          Max Sharpe Ratio
          <span className="text-muted/50 mx-1">·</span>
          {points.length} portfolios
          <span className="text-muted/50 mx-1">·</span>
          <span style={{ color: SELECTED_C }}>■</span>
          <span className="text-[#8892a4]">click a point to inspect</span>
        </p>

        <ResponsiveContainer width="100%" height={320}>
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
              content={<ScatterTooltip />}
              cursor={{ strokeDasharray: '3 3', stroke: ACCENT }}
            />
            <Scatter
              data={points}
              line={{ stroke: ACCENT, strokeWidth: 1.8, opacity: 0.9 }}
              lineType="joint"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={renderDot as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(pt: any) => handleScatterClick(pt as ChartPoint)}
              isAnimationActive={false}
            />
            {/* Max Sharpe dot */}
            {msPoint && (
              <ReferenceDot
                x={msPoint.x} y={msPoint.y}
                r={7}
                fill={MAX_SHARPE_C}
                stroke="#0d1117"
                strokeWidth={2}
              />
            )}
            {/* Selected dot */}
            {selPoint && selectedIdx !== maxSharpeI && (
              <ReferenceDot
                x={selPoint.x} y={selPoint.y}
                r={7}
                fill={SELECTED_C}
                stroke="#0d1117"
                strokeWidth={2}
              />
            )}
            {/* Selected dot when it coincides with max sharpe */}
            {selPoint && selectedIdx === maxSharpeI && (
              <ReferenceDot
                x={selPoint.x} y={selPoint.y}
                r={9}
                fill={SELECTED_C}
                stroke="#0d1117"
                strokeWidth={2}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>

        {/* Selected point composition panel */}
        {selPortfolio && selPoint && (
          <div className="mt-3 bg-[#080a0f] border border-[#f59e0b]/30 rounded-lg p-3">
            <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: SELECTED_C }}>
              Composition at selected point — Return:&nbsp;
              <span style={{ color: '#00d4aa' }}>{selPoint.y.toFixed(2)}%</span>
              &nbsp;| Volatility:&nbsp;
              <span style={{ color: ACCENT }}>{selPoint.x.toFixed(2)}%</span>
              &nbsp;| Sharpe:&nbsp;
              <span style={{ color: SELECTED_C }}>
                {selPoint.x > 0 ? (selPoint.y / selPoint.x).toFixed(3) : '—'}
              </span>
            </p>
            <MiniWeights weights={selPortfolio.weights} tickers={tickers} />
          </div>
        )}
      </div>

      {/* ── Stacked Area: Composition along the frontier ── */}
      <div className="border-t border-border pt-5">
        <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-1">
          Portfolio Composition Along the Frontier
        </p>
        <p className="text-[10px] text-muted font-mono mb-4">
          How asset weights evolve from minimum risk to maximum return
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={areaData}
            margin={{ top: 8, right: 24, bottom: 36, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis
              dataKey="volatility"
              tick={{ fill: AXIS_COLOR, fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}
              label={{ value: 'Volatility (%)', position: 'insideBottom', offset: -20, fill: AXIS_COLOR, fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={v => `${v}%`}
              domain={[0, 100]}
              tick={{ fill: AXIS_COLOR, fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}
            />
            <Tooltip content={<AreaTooltip />} />
            <Legend
              wrapperStyle={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 9,
                paddingTop: 8,
              }}
              formatter={value => (
                <span style={{ color: '#8892a4' }}>{value}</span>
              )}
            />
            {tickers.map((ticker, i) => (
              <Area
                key={ticker}
                type="monotone"
                dataKey={ticker}
                stackId="1"
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.75}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
