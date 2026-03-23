import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { PortfolioMetrics, RiskDecompositionData, TickerMatch } from '../types'

const COLORS = [
  '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#a78bfa', '#34d399', '#fb923c', '#e879f9', '#facc15',
  '#64748b', '#22d3ee', '#f97316', '#84cc16', '#ec4899',
]

// ── Sector colour palette (consistent with ConstraintsPanel) ──────────────────
const SECTOR_COLORS: Record<string, string> = {
  'Technology':              '#2563eb',
  'Healthcare':              '#10b981',
  'Financials':              '#f59e0b',
  'Consumer Discretionary':  '#ef4444',
  'Consumer Staples':        '#a78bfa',
  'Energy':                  '#fb923c',
  'Industrials':             '#0ea5e9',
  'Materials':               '#34d399',
  'Utilities':               '#e879f9',
  'Real Estate':             '#facc15',
  'Communication Services':  '#f43f5e',
  'Aerospace & Defense':     '#64748b',
  'Broad Market':            '#94a3b8',
  'International Equity':    '#6366f1',
  'Factor ETF':              '#ec4899',
  'Government Bonds':        '#14b8a6',
  'Corporate Bonds':         '#f97316',
  'Aggregate Bonds':         '#8b5cf6',
  'Emerging Market Bonds':   '#22d3ee',
  'Commodities':             '#d97706',
  'Cryptocurrency':          '#84cc16',
}

interface Props {
  weights:             Record<string, number>
  metrics?:            PortfolioMetrics
  risk_decomposition?: RiskDecompositionData
  assets?:             TickerMatch[]
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

// ── Custom tooltip for asset view ─────────────────────────────────────────────

const ROW: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3,
}

function WeightsTooltip({
  active, payload, riskLookup, assets,
}: {
  active?:     boolean
  payload?:    { payload: { name: string; value: number } }[]
  riskLookup:  RiskLookup | null
  assets?:     TickerMatch[]
}) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  const risk  = riskLookup?.[name] ?? null
  const asset = assets?.find(a => a.ticker === name)
  return (
    <div style={{
      background: '#0d1117', border: '1px solid rgba(79,142,247,0.45)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
      minWidth: 180, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#4f8ef7', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{name}</div>
      {asset?.name && (
        <div style={{ color: '#8892a4', fontSize: 10, marginBottom: 6, lineHeight: 1.3 }}>{asset.name}</div>
      )}
      {asset?.sector && (
        <div style={{ color: '#6366f1', fontSize: 10, marginBottom: 6 }}>{asset.sector}</div>
      )}
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

// ── Custom tooltip for sector view ────────────────────────────────────────────

function SectorTooltip({
  active, payload,
}: {
  active?:  boolean
  payload?: { payload: { name: string; value: number; tickers: string[] } }[]
}) {
  if (!active || !payload?.length) return null
  const { name, value, tickers } = payload[0].payload
  return (
    <div style={{
      background: '#0d1117', border: '1px solid rgba(79,142,247,0.45)',
      borderRadius: 8, padding: '10px 14px',
      fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
      minWidth: 180, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: SECTOR_COLORS[name] ?? '#4f8ef7', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
        {name}
      </div>
      <div style={ROW}>
        <span style={{ color: '#8892a4' }}>Allocation</span>
        <span style={{ color: '#4f8ef7', fontWeight: 700 }}>{value.toFixed(2)}%</span>
      </div>
      <div style={{ marginTop: 6, color: '#8892a4', fontSize: 10 }}>
        {tickers.join(' · ')}
      </div>
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

export function WeightsChart({ weights, metrics, risk_decomposition, assets }: Props) {
  const [activeIndex, setActiveIndex]   = useState<number | null>(null)
  const [activeSector, setActiveSector] = useState<number | null>(null)
  const [view, setView] = useState<'asset' | 'sector'>('asset')

  // ── Asset-level data ──────────────────────────────────────────────────────
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

  // ── Sector-level data ─────────────────────────────────────────────────────
  const sectorMap: Record<string, { value: number; tickers: string[] }> = {}
  let unclassifiedWeight = 0

  if (assets) {
    for (const [ticker, rawWeight] of Object.entries(weights)) {
      if (rawWeight <= 0.001) continue
      const pct    = Math.round(rawWeight * 10000) / 100
      const asset  = assets.find(a => a.ticker === ticker)
      const sector = asset?.sector?.trim() || ''
      if (sector) {
        if (!sectorMap[sector]) sectorMap[sector] = { value: 0, tickers: [] }
        sectorMap[sector].value   += pct
        sectorMap[sector].tickers.push(ticker)
      } else {
        unclassifiedWeight += pct
      }
    }
  }

  if (unclassifiedWeight > 0.01) {
    sectorMap['Other'] = {
      value:   Math.round(unclassifiedWeight * 100) / 100,
      tickers: [],
    }
  }

  const sectorData = Object.entries(sectorMap)
    .map(([name, { value, tickers }]) => ({
      name,
      value:   Math.round(value * 100) / 100,
      tickers,
    }))
    .sort((a, b) => b.value - a.value)

  const hasSectors  = assets && sectorData.length > 0
  const activeSec   = activeSector !== null ? sectorData[activeSector] : null

  return (
    <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
      {/* ── Header + view toggle ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="terminal-label">Optimal Weights</p>
        {hasSectors && (
          <div className="flex border border-border rounded overflow-hidden">
            {(['asset', 'sector'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wide transition-colors ${
                  view === v
                    ? 'bg-accent/20 text-accent'
                    : 'text-muted hover:text-[#e8eaf0]'
                }`}
              >
                {v === 'asset' ? 'By Asset' : 'By Sector'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── By-Asset view ── */}
      {view === 'asset' && (
        <div className="flex gap-6 items-center">
          {/* Left: pie chart */}
          <div style={{ flex: '0 0 58%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={110}
                  paddingAngle={2} dataKey="value"
                  strokeWidth={0} isAnimationActive={false}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={(props) => (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <WeightsTooltip {...(props as any)} riskLookup={riskLookup} assets={assets} />
                )} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', textAlign: 'center',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {activeItem ? (
                <>
                  <div style={{ color: '#4f8ef7', fontWeight: 700, fontSize: 11 }}>{activeItem.name}</div>
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

          {/* Right: legend */}
          <div style={{ flex: '1 1 0', minWidth: 0 }} className="space-y-2.5 py-1">
            {data.map((item, i) => {
              const color     = COLORS[i % COLORS.length]
              const pct       = item.value
              const highlight = pct > 20
              return (
                <div key={item.name}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-mono font-semibold text-accent text-xs tracking-wide flex-1 truncate">
                      {item.name}
                    </span>
                    <span className="font-mono font-semibold text-xs shrink-0"
                      style={{ color: highlight ? '#00d4aa' : '#e8eaf0' }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${(pct / maxValue) * 100}%`,
                      backgroundColor: color, opacity: 0.75,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── By-Sector view ── */}
      {view === 'sector' && hasSectors && (
        <div className="flex gap-6 items-center">
          {/* Left: sector pie */}
          <div style={{ flex: '0 0 58%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={sectorData} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={110}
                  paddingAngle={2} dataKey="value"
                  strokeWidth={0} isAnimationActive={false}
                  onMouseEnter={(_, index) => setActiveSector(index)}
                  onMouseLeave={() => setActiveSector(null)}
                >
                  {sectorData.map((entry, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={(props) => (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <SectorTooltip {...(props as any)} />
                )} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', textAlign: 'center',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {activeSec ? (
                <>
                  <div style={{ color: SECTOR_COLORS[activeSec.name] ?? '#4f8ef7', fontWeight: 700, fontSize: 10 }}>
                    {activeSec.name.split(' ').slice(0, 2).join(' ')}
                  </div>
                  <div style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 15, marginTop: 2 }}>
                    {activeSec.value.toFixed(1)}%
                  </div>
                </>
              ) : (
                <div style={{ color: '#8892a4', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Sectors
                </div>
              )}
            </div>
          </div>

          {/* Right: sector legend */}
          <div style={{ flex: '1 1 0', minWidth: 0 }} className="space-y-2.5 py-1">
            {sectorData.map((item) => {
              const color = SECTOR_COLORS[item.name] ?? '#8892a4'
              const pct   = item.value
              const maxSec = sectorData[0]?.value ?? 100
              return (
                <div key={item.name}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-mono font-semibold text-xs flex-1 truncate" style={{ color }}>
                      {item.name}
                    </span>
                    <span className="font-mono font-semibold text-xs shrink-0 text-[#e8eaf0]">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${(pct / maxSec) * 100}%`,
                      backgroundColor: color, opacity: 0.75,
                    }} />
                  </div>
                  <div className="text-[9px] font-mono text-muted mt-0.5 truncate">
                    {item.tickers.join(' · ')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Metrics grid ── */}
      {metrics && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="terminal-label mb-3">Performance Metrics</p>
          <div className="grid grid-cols-3 gap-2">
            {METRIC_DEFS.map(({ key, label, pct, invert }) => {
              const v     = metrics[key]
              const color = metricColor(v, invert)
              return (
                <div key={key}
                  className="bg-[#07090f] border border-border rounded-lg p-3 hover:border-border-bright transition-colors cursor-default"
                >
                  <p className="text-[9px] text-muted font-mono uppercase tracking-wider mb-1.5 leading-none">{label}</p>
                  <p className="font-mono font-bold text-base leading-none" style={{ color }}>{fmt(v, pct)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
