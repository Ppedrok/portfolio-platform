/**
 * FactorExposure.tsx
 * ------------------
 * Displays Fama-French / Carhart factor exposure analysis:
 *   - Model selector (FF3 / FF5 / Carhart4)
 *   - Beta heatmap table with significance stars
 *   - Grouped bar chart: betas per asset
 *   - R² and annualised alpha per asset
 */

import { useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { FactorExposureResponse, FactorModel, AssetFactorRow } from '../types'
import { getFactorExposure } from '../api/client'

// ── colours per factor ─────────────────────────────────────────────────────────
const FACTOR_COLORS: Record<string, string> = {
  'Mkt-RF': '#38bdf8',
  'SMB':    '#34d399',
  'HML':    '#f59e0b',
  'RMW':    '#a78bfa',
  'CMA':    '#fb923c',
  'MOM':    '#f472b6',
}
const FACTOR_FALLBACK = ['#38bdf8','#34d399','#f59e0b','#a78bfa','#fb923c','#f472b6']

// ── helpers ────────────────────────────────────────────────────────────────────

function sigStars(p: number): string {
  if (p < 0.01)  return '***'
  if (p < 0.05)  return '**'
  if (p < 0.10)  return '*'
  return ''
}

function betaColor(v: number): string {
  const abs = Math.min(Math.abs(v), 2)
  const t   = abs / 2
  if (v >= 0) {
    const r = Math.round(56  + (14  - 56)  * (1 - t))
    const g = Math.round(189 + (165 - 189) * (1 - t))
    const b = Math.round(248 + (0   - 248) * (1 - t))
    return `rgb(${r},${g},${b})`
  } else {
    const r = Math.round(248 + (239 - 248) * (1 - t))
    const g = Math.round(113 + (68  - 113) * (1 - t))
    const b = Math.round(113 + (68  - 113) * (1 - t))
    return `rgb(${r},${g},${b})`
  }
}

function fmt2(v: number): string { return v.toFixed(2) }
function fmtPct(v: number): string { return `${(v * 100).toFixed(1)}%` }

interface Props {
  tickers:   string[]
  startDate: string
  endDate:   string
}

export function FactorExposure({ tickers, startDate, endDate }: Props) {
  const [model,   setModel]   = useState<FactorModel>('FF3')
  const [data,    setData]    = useState<FactorExposureResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [view,    setView]    = useState<'heatmap' | 'bars' | 'stats'>('heatmap')

  const run = useCallback(async () => {
    if (tickers.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await getFactorExposure(tickers, startDate, endDate, model)
      setData(res)
    } catch (e: any) {
      setError(e.message ?? 'Factor exposure failed')
    } finally {
      setLoading(false)
    }
  }, [tickers, startDate, endDate, model])

  // ── bar chart data ─────────────────────────────────────────────────────────
  function buildBarData(assets: AssetFactorRow[], factors: string[]) {
    return assets.map(a => ({
      ticker: a.ticker,
      ...Object.fromEntries(factors.map(f => [f, +a.betas[f].toFixed(3)])),
    }))
  }

  const factors    = data?.factors ?? []
  const assets     = data?.assets  ?? []
  const barData    = data ? buildBarData(assets, factors) : []

  return (
    <div className="space-y-4">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-mono">Model</span>
          <select
            value={model}
            onChange={e => setModel(e.target.value as FactorModel)}
            className="bg-[#0d1117] border border-[#1e2530] rounded px-2 py-1 text-xs text-[#e8eaf0]
                       focus:outline-none focus:border-[#38bdf8]"
          >
            <option value="FF3">Fama-French 3 (MKT, SMB, HML)</option>
            <option value="FF5">Fama-French 5 (MKT, SMB, HML, RMW, CMA)</option>
            <option value="Carhart4">Carhart 4 (MKT, SMB, HML, MOM)</option>
          </select>
        </div>

        <button
          onClick={run}
          disabled={loading || tickers.length === 0}
          className="px-4 py-1.5 rounded text-xs font-semibold bg-[#38bdf8] text-[#0d1117]
                     hover:bg-[#7dd3fc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Computing…' : 'Run Factor Analysis'}
        </button>

        {data && (
          <div className="flex gap-1 ml-auto">
            {(['heatmap', 'bars', 'stats'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                  view === v
                    ? 'bg-[#38bdf8] text-[#0d1117]'
                    : 'bg-[#0d1117] border border-[#1e2530] text-muted hover:border-[#38bdf8]'
                }`}
              >
                {v === 'heatmap' ? 'Beta Table' : v === 'bars' ? 'Bar Chart' : 'Statistics'}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted text-xs font-mono">
          <span className="animate-pulse">Downloading Fama-French factors & running OLS…</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── Model badge ── */}
          <div className="flex items-center gap-2 text-xs text-muted font-mono">
            <span className="px-2 py-0.5 rounded bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[#38bdf8]">
              {data.model}
            </span>
            <span>factors: {data.factors.join(', ')}</span>
            <span className="ml-4 text-[10px]">* p&lt;0.1 &nbsp;** p&lt;0.05 &nbsp;*** p&lt;0.01</span>
          </div>

          {/* ── HEATMAP VIEW ── */}
          {view === 'heatmap' && (
            <div className="overflow-x-auto rounded border border-[#1e2530]">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-[#0d1117] text-muted border-b border-[#1e2530]">
                    <th className="px-3 py-2 text-left">Ticker</th>
                    {factors.map(f => (
                      <th key={f} className="px-3 py-2 text-center" style={{ color: FACTOR_COLORS[f] ?? '#e8eaf0' }}>
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a, i) => (
                    <tr
                      key={a.ticker}
                      className={`border-b border-[#1e2530] ${i % 2 === 0 ? 'bg-[#0d1117]/50' : ''}`}
                    >
                      <td className="px-3 py-2 font-semibold text-[#e8eaf0]">{a.ticker}</td>
                      {factors.map(f => {
                        const beta = a.betas[f]
                        const p    = a.p_values[f]
                        const t    = a.t_stats[f]
                        return (
                          <td
                            key={f}
                            className="px-3 py-2 text-center relative group"
                            title={`t = ${t.toFixed(2)}, p = ${p.toFixed(3)}`}
                          >
                            <span
                              className="px-2 py-0.5 rounded text-[#0d1117] font-bold"
                              style={{ backgroundColor: betaColor(beta) }}
                            >
                              {fmt2(beta)}{sigStars(p)}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── BAR CHART VIEW ── */}
          {view === 'bars' && (
            <div className="bg-[#0d1117] border border-[#1e2530] rounded p-4" style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
                  <XAxis dataKey="ticker" tick={{ fill: '#8892a4', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#8892a4', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: 6 }}
                    labelStyle={{ color: '#e8eaf0', fontSize: 12 }}
                    itemStyle={{ fontSize: 11 }}
                    formatter={(v: number) => v.toFixed(3)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#8892a4' }} />
                  <ReferenceLine y={0} stroke="#334155" />
                  {factors.map((f, idx) => (
                    <Bar
                      key={f}
                      dataKey={f}
                      fill={FACTOR_COLORS[f] ?? FACTOR_FALLBACK[idx % FACTOR_FALLBACK.length]}
                      radius={[2, 2, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── STATISTICS VIEW ── */}
          {view === 'stats' && (
            <div className="overflow-x-auto rounded border border-[#1e2530]">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-[#0d1117] text-muted border-b border-[#1e2530]">
                    <th className="px-3 py-2 text-left">Ticker</th>
                    <th className="px-3 py-2 text-right">Alpha (ann.)</th>
                    <th className="px-3 py-2 text-right">R²</th>
                    {factors.map(f => (
                      <th key={f} className="px-3 py-2 text-right" style={{ color: FACTOR_COLORS[f] ?? '#e8eaf0' }}>
                        β {f}
                      </th>
                    ))}
                    {factors.map(f => (
                      <th key={`t_${f}`} className="px-3 py-2 text-right text-[#8892a4]">
                        t({f})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a, i) => (
                    <tr
                      key={a.ticker}
                      className={`border-b border-[#1e2530] ${i % 2 === 0 ? 'bg-[#0d1117]/50' : ''}`}
                    >
                      <td className="px-3 py-2 font-semibold text-[#e8eaf0]">{a.ticker}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${a.alpha >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtPct(a.alpha)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`px-1.5 py-0.5 rounded ${a.r2 > 0.7 ? 'text-emerald-400' : a.r2 > 0.4 ? 'text-amber-400' : 'text-muted'}`}>
                          {(a.r2 * 100).toFixed(1)}%
                        </span>
                      </td>
                      {factors.map(f => (
                        <td key={f} className="px-3 py-2 text-right text-[#e8eaf0]">
                          {fmt2(a.betas[f])}{sigStars(a.p_values[f])}
                        </td>
                      ))}
                      {factors.map(f => (
                        <td key={`t_${f}`} className="px-3 py-2 text-right text-muted">
                          {a.t_stats[f].toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Interpretation footer ── */}
          <div className="text-[10px] text-muted font-mono leading-relaxed bg-[#0d1117] border border-[#1e2530] rounded px-3 py-2">
            <span className="text-[#38bdf8]">Mkt-RF</span> market beta · &nbsp;
            <span className="text-[#34d399]">SMB</span> small-minus-big (size) · &nbsp;
            <span className="text-[#f59e0b]">HML</span> high-minus-low (value) · &nbsp;
            {factors.includes('RMW') && <><span className="text-[#a78bfa]">RMW</span> robust-minus-weak (profitability) · &nbsp;</>}
            {factors.includes('CMA') && <><span className="text-[#fb923c]">CMA</span> conservative-minus-aggressive (investment) · &nbsp;</>}
            {factors.includes('MOM') && <><span className="text-[#f472b6]">MOM</span> momentum · &nbsp;</>}
            Alpha is Jensen's alpha annualised. Stars denote OLS significance.
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted text-xs font-mono gap-2">
          <span>Select a factor model and click <span className="text-[#38bdf8]">Run Factor Analysis</span></span>
          <span className="text-[10px]">Requires at least 2 assets and a valid date range</span>
        </div>
      )}
    </div>
  )
}
