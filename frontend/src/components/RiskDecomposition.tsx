import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import type { RiskDecompositionData } from '../types'

// ── Formatters ────────────────────────────────────────────────────────────────

function pct(v: number): string { return `${(v * 100).toFixed(2)}%` }
function fmtPct(v: number): string { return `${(v * 100).toFixed(1)}%` }

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
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
      fontSize: 11,
    }}>
      <div style={{ color: '#8892a4', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color ?? '#e8eaf0', fontWeight: 600, marginTop: 2 }}>
          {p.name}: {fmtPct(p.value)}
        </div>
      ))}
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#080a0f] border border-[#1e2530] rounded-lg p-3 hover:border-accent/30 transition-colors">
      <p className="text-[9px] text-muted font-mono uppercase tracking-wider mb-1.5 leading-none">{label}</p>
      <p className="font-mono font-bold text-base leading-none text-[#e8eaf0]">{value}</p>
      {sub && <p className="text-[10px] text-muted font-mono mt-1">{sub}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { data: RiskDecompositionData }

export function RiskDecomposition({ data }: Props) {
  const {
    assets,
    weights,
    percentage_risk_contribution: prc,
    percentage_cvar_contribution: pcvar,
    individual_volatilities,
    portfolio_volatility,
    diversification_ratio,
    portfolio_cvar,
  } = data

  // Dual bar chart data: weight vs % risk
  const barData = assets.map((a, i) => ({
    asset: a,
    weight: weights[i],
    risk:   prc[i],
  }))

  // CVaR bar chart data
  const cvarData = assets.map((a, i) => ({
    asset: a,
    weight:   weights[i],
    cvar_pct: pcvar[i],
  }))

  // Risk efficiency table: sorted by |prc - weight|
  const tableRows = assets
    .map((a, i) => ({
      asset:      a,
      weight:     weights[i],
      indiv_vol:  individual_volatilities[i],
      prc:        prc[i],
      imbalance:  Math.abs(prc[i] - weights[i]),
    }))
    .sort((a, b) => b.imbalance - a.imbalance)

  // Auto-insights
  const maxImbalance = tableRows[0]
  const mostConcentrated = [...assets]
    .map((a, i) => ({ a, prc: prc[i] }))
    .sort((x, y) => y.prc - x.prc)[0]

  const insights: string[] = []
  if (maxImbalance.imbalance > 0.05) {
    const dir = maxImbalance.prc > maxImbalance.weight ? 'higher' : 'lower'
    insights.push(
      `${maxImbalance.asset} has ${pct(maxImbalance.imbalance)} ${dir} risk contribution than its weight — consider rebalancing.`
    )
  }
  if (diversification_ratio < 1.1) {
    insights.push('Portfolio is highly concentrated — diversification ratio is near 1.')
  } else if (diversification_ratio > 1.5) {
    insights.push(`Good diversification: ratio ${diversification_ratio.toFixed(2)} indicates strong risk reduction.`)
  }
  if (mostConcentrated.prc > 0.4) {
    insights.push(`${mostConcentrated.a} drives ${pct(mostConcentrated.prc)} of portfolio risk.`)
  }

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-border">
      <p className="text-[10px] text-muted font-mono uppercase tracking-widest">
        Risk Contribution &amp; Decomposition
      </p>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label="Portfolio Volatility"
          value={pct(portfolio_volatility)}
          sub="Annualised"
        />
        <MetricCard
          label="Diversification Ratio"
          value={diversification_ratio.toFixed(3)}
          sub="Weighted vol / port vol"
        />
        <MetricCard
          label="CVaR 95%"
          value={pct(Math.abs(portfolio_cvar))}
          sub="Expected tail loss"
        />
      </div>

      {/* ── Dual bar chart: Weight vs Risk % ── */}
      <div className="bg-[#080a0f] border border-[#1e2530] rounded-lg p-3">
        <p className="text-[9px] text-muted font-mono uppercase tracking-wider mb-3">
          Weight vs Risk Contribution
        </p>
        <ResponsiveContainer width="100%" height={Math.max(160, assets.length * 32)}>
          <BarChart
            data={barData}
            layout="vertical"
            barCategoryGap="25%"
            barGap={2}
            margin={{ left: 8, right: 16, top: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: '#8892a4', fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="asset"
              width={52}
              tick={{ fill: '#8892a4', fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79,142,247,0.04)' }} />
            <ReferenceLine x={0} stroke="#1e2530" />
            <Bar dataKey="weight" name="Weight" fill="#4f8ef7" radius={[0, 2, 2, 0]} />
            <Bar dataKey="risk"   name="Risk %"  fill="#f43f5e" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="flex gap-4 mt-2">
          {[['#4f8ef7', 'Weight'], ['#f43f5e', 'Risk %']].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-muted font-mono">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CVaR bar chart ── */}
      <div className="bg-[#080a0f] border border-[#1e2530] rounded-lg p-3">
        <p className="text-[9px] text-muted font-mono uppercase tracking-wider mb-3">
          Weight vs CVaR Contribution
        </p>
        <ResponsiveContainer width="100%" height={Math.max(160, assets.length * 32)}>
          <BarChart
            data={cvarData}
            layout="vertical"
            barCategoryGap="25%"
            barGap={2}
            margin={{ left: 8, right: 16, top: 0, bottom: 0 }}
          >
            <XAxis
              type="number"
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: '#8892a4', fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="asset"
              width={52}
              tick={{ fill: '#8892a4', fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79,142,247,0.04)' }} />
            <ReferenceLine x={0} stroke="#1e2530" />
            <Bar dataKey="weight"   name="Weight"   fill="#4f8ef7" radius={[0, 2, 2, 0]} />
            <Bar dataKey="cvar_pct" name="CVaR %"   fill="#f59e0b" radius={[0, 2, 2, 0]}>
              {cvarData.map((_, i) => (
                <Cell key={i} fill={pcvar[i] < 0 ? '#00d4aa' : '#f59e0b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2">
          {[['#4f8ef7', 'Weight'], ['#f59e0b', 'CVaR %']].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-muted font-mono">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Risk efficiency table ── */}
      <div className="bg-[#080a0f] border border-[#1e2530] rounded-lg p-3">
        <p className="text-[9px] text-muted font-mono uppercase tracking-wider mb-3">
          Risk Efficiency (sorted by imbalance)
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e2530]">
              {['Asset', 'Weight', 'Indiv. Vol', 'Risk %', 'Imbalance'].map(h => (
                <th key={h} className="pb-2 text-left text-[9px] text-muted font-mono font-normal uppercase tracking-widest first:pl-0 pl-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => {
              const over = row.prc > row.weight + 0.02
              const under = row.prc < row.weight - 0.02
              const rowColor = over ? 'rgba(244,63,94,0.06)' : under ? 'rgba(0,212,170,0.06)' : 'transparent'
              return (
                <tr key={row.asset} style={{ backgroundColor: rowColor }}>
                  <td className="py-1.5 font-mono font-semibold text-accent text-[10px]">{row.asset}</td>
                  <td className="py-1.5 pl-2 font-mono text-[#e8eaf0] text-[10px]">{fmtPct(row.weight)}</td>
                  <td className="py-1.5 pl-2 font-mono text-muted text-[10px]">{fmtPct(row.indiv_vol)}</td>
                  <td className={`py-1.5 pl-2 font-mono font-medium text-[10px] ${over ? 'text-negative' : under ? 'text-positive' : 'text-[#e8eaf0]'}`}>
                    {fmtPct(row.prc)}
                  </td>
                  <td className={`py-1.5 pl-2 font-mono text-[10px] ${row.imbalance > 0.05 ? 'text-negative' : 'text-muted'}`}>
                    {fmtPct(row.imbalance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex gap-4 mt-2 pt-2 border-t border-[#1e2530]">
          {[['rgba(244,63,94,0.15)', 'Over-weighted risk'], ['rgba(0,212,170,0.15)', 'Under-weighted risk']].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border border-[#1e2530]" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-muted font-mono">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Auto insights ── */}
      {insights.length > 0 && (
        <div className="bg-[#080a0f] border border-accent/20 rounded-lg p-3 space-y-1.5">
          <p className="text-[9px] text-accent font-mono uppercase tracking-wider mb-2">Insights</p>
          {insights.map((ins, i) => (
            <p key={i} className="text-[10px] text-muted font-mono leading-relaxed">
              <span className="text-accent mr-1">›</span>{ins}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
