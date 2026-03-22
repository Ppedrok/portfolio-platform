import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { PortfolioMetrics, RiskDecompositionData } from '../types'

const COLORS = [
  '#4f8ef7', '#00d4aa', '#f59e0b', '#f43f5e', '#a78bfa',
  '#34d399', '#fb923c', '#38bdf8', '#e879f9', '#facc15',
]

interface Props {
  weights:           Record<string, number>
  metrics?:          PortfolioMetrics
  risk_decomposition?: RiskDecompositionData
}

type RiskLookup = Record<string, { mrc: number; prc: number; crc: number }>

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, pct: boolean): string {
  if (v == null) return '—'
  return pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(3)
}

function metricColor(v: number | null | undefined, invert = false): string {
  if (v == null) return '#e8eaf0'
  const isPos = invert ? v < 0 : v > 0
  return isPos ? '#00d4aa' : '#ff4d6a'
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

const ROW: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3,
}

function WeightsTooltip({
  active, payload, riskLookup,
}: {
  active?:     boolean
  payload?:    { payload: { name: string; value: number } }[]
  riskLookup:  RiskLookup | null
}) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  const risk = riskLookup?.[name] ?? null
  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid rgba(79,142,247,0.45)',
      borderRadius: 8,
      padding: '10px 14px',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11,
      minWidth: 170,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#4f8ef7', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{name}</div>
      <div style={ROW}>
        <span style={{ color: '#8892a4' }}>Weight</span>
        <span style={{ color: '#4f8ef7', fontWeight: 700 }}>{value.toFixed(2)}%</span>
      </div>
      {risk && (
        <>
          <div style={ROW}>
            <span style={{ color: '#8892a4' }}>MRC</span>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>{risk.mrc.toFixed(4)}</span>
          </div>
          <div style={ROW}>
            <span style={{ color: '#8892a4' }}>CRC %</span>
            <span style={{ color: '#f43f5e', fontWeight: 700 }}>{(risk.prc * 100).toFixed(2)}%</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── Metric card definitions ───────────────────────────────────────────────────

const METRIC_DEFS: {
  key: keyof PortfolioMetrics; label: string; pct: boolean; invert?: boolean
}[] = [
  { key: 'annualized_return',     label: 'Ann. Return',  pct: true              },
  { key: 'annualized_volatility', label: 'Volatility',   pct: true              },
  { key: 'sharpe_ratio',          label: 'Sharpe Ratio', pct: false             },
  { key: 'sortino_ratio',         label: 'Sortino',      pct: false             },
  { key: 'max_drawdown',          label: 'Max Drawdown', pct: true,  invert: true },
  { key: 'calmar_ratio',          label: 'Calmar',       pct: false             },
  { key: 'var_95',                label: 'VaR 95%',      pct: true,  invert: true },
  { key: 'cvar_95',               label: 'CVaR 95%',     pct: true,  invert: true },
  { key: 'win_rate',              label: 'Win Rate',     pct: true              },
]

// ── Main component ────────────────────────────────────────────────────────────

export function WeightsChart({ weights, metrics, risk_decomposition }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const data = Object.entries(weights)
    .filter(([, v]) => v > 0.001)
    .map(([name, value]) => ({ name, value: Math.round(value * 10000) / 100 }))
    .sort((a, b) => b.value - a.value)

  const maxValue = data[0]?.value ?? 100

  const riskLookup: RiskLookup | null = risk_decomposition
    ? Object.fromEntries(
        risk_decomposition.assets.map((a, i) => [a, {
          mrc: risk_decomposition.marginal_risk_contribution[i],
          prc: risk_decomposition.percentage_risk_contribution[i],
          crc: risk_decomposition.component_risk_contribution[i],
        }])
      )
    : null

  const activeItem = activeIndex !== null ? data[activeIndex] : null

  return (
    <div className="bg-card rounded-panel p-4 border border-border">
      <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-4">
        Optimal Weights
      </p>

      {/* ── Two-column layout: pie chart + legend ── */}
      <div className="flex gap-6 items-center">

        {/* Left: pie chart (60%) — with center label overlay */}
        <div style={{ flex: '0 0 58%', position: 'relative' }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
                isAnimationActive={false}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={(props) => (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <WeightsTooltip {...(props as any)} riskLookup={riskLookup} />
              )} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            textAlign: 'center',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {activeItem ? (
              <>
                <div style={{ color: '#4f8ef7', fontWeight: 700, fontSize: 11, letterSpacing: '0.03em' }}>
                  {activeItem.name}
                </div>
                <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 15, marginTop: 2 }}>
                  {activeItem.value.toFixed(1)}%
                </div>
              </>
            ) : (
              <div style={{ color: '#8892a4', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Weights
              </div>
            )}
          </div>
        </div>

        {/* Right: legend table (40%) */}
        <div style={{ flex: '1 1 0', minWidth: 0 }} className="space-y-2.5 py-1">
          {data.map((item, i) => {
            const color    = COLORS[i % COLORS.length]
            const pct      = item.value
            const highlight = pct > 20
            return (
              <div key={item.name}>
                <div className="flex items-center gap-2 mb-0.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-mono font-semibold text-accent text-xs tracking-wide flex-1 truncate">
                    {item.name}
                  </span>
                  <span
                    className="font-mono font-semibold text-xs shrink-0"
                    style={{ color: highlight ? '#00d4aa' : '#e8eaf0' }}
                  >
                    {pct.toFixed(1)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(pct / maxValue) * 100}%`,
                      backgroundColor: color,
                      opacity: 0.75,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Metrics grid ── */}
      {metrics && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-3">
            Performance Metrics
          </p>
          <div className="grid grid-cols-3 gap-2">
            {METRIC_DEFS.map(({ key, label, pct, invert }) => {
              const v     = metrics[key]
              const color = metricColor(v, invert)
              return (
                <div
                  key={key}
                  className="bg-[#080a0f] border border-[#1e2530] rounded-lg p-3 hover:border-accent/30 transition-colors cursor-default"
                >
                  <p className="text-[9px] text-muted font-mono uppercase tracking-wider mb-1.5 leading-none">
                    {label}
                  </p>
                  <p className="font-mono font-bold text-base leading-none" style={{ color }}>
                    {fmt(v, pct)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
