import type { PortfolioMetrics } from '../types'

function fmt(v: number | null | undefined, isPercent: boolean): string {
  if (v == null) return '—'
  if (isPercent) return `${(v * 100).toFixed(2)}%`
  return v.toFixed(3)
}

function valColor(v: number | null | undefined, invert = false): string {
  if (v == null) return 'text-[#c8d0e0]'
  const pos = invert ? v < 0 : v > 0
  return pos ? 'text-positive' : 'text-negative'
}

function ratioColor(v: number | null | undefined): string {
  if (v == null) return 'text-[#c8d0e0]'
  if (v >= 1)   return 'text-positive'
  if (v < 0.5)  return 'text-warning'
  return 'text-[#c8d0e0]'
}

// ── Single portfolio metrics ───────────────────────────────────────────────────

const SINGLE_ROWS: {
  key: keyof PortfolioMetrics; label: string; pct: boolean; colored: boolean; invert?: boolean; isRatio?: boolean
}[] = [
  { key: 'annualized_return',     label: 'Ann. Return',     pct: true,  colored: true  },
  { key: 'annualized_volatility', label: 'Ann. Volatility', pct: true,  colored: false },
  { key: 'sharpe_ratio',          label: 'Sharpe Ratio',    pct: false, colored: true,  isRatio: true },
  { key: 'sortino_ratio',         label: 'Sortino Ratio',   pct: false, colored: true,  isRatio: true },
  { key: 'max_drawdown',          label: 'Max Drawdown',    pct: true,  colored: true, invert: true },
  { key: 'calmar_ratio',          label: 'Calmar Ratio',    pct: false, colored: true  },
  { key: 'var_95',                label: 'VaR 95%',         pct: true,  colored: true, invert: true },
  { key: 'cvar_95',               label: 'CVaR 95%',        pct: true,  colored: true, invert: true },
  { key: 'win_rate',              label: 'Win Rate',        pct: true,  colored: false },
]

export function MetricsTable({ metrics }: { metrics: PortfolioMetrics }) {
  const ret = metrics.annualized_return
  const sr  = metrics.sharpe_ratio

  return (
    <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
      <p className="terminal-label mb-3">Performance Metrics</p>

      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#07090f] rounded-panel p-3 border border-border">
          <p className="terminal-label mb-1.5">Ann. Return</p>
          <p className={`text-xl font-mono font-semibold num ${ret != null && ret > 0 ? 'text-positive glow-green' : ret != null ? 'text-negative' : 'text-[#c8d0e0]'}`}>
            {fmt(ret, true)}
          </p>
        </div>
        <div className="bg-[#07090f] rounded-panel p-3 border border-border">
          <p className="terminal-label mb-1.5">Sharpe Ratio</p>
          <p className={`text-xl font-mono font-semibold num ${ratioColor(sr)}`}>
            {fmt(sr, false)}
          </p>
        </div>
      </div>

      {/* Detail table */}
      <table className="w-full text-xs">
        <tbody>
          {SINGLE_ROWS.map(({ key, label, pct, colored, invert, isRatio }) => {
            const v = metrics[key]
            const colorCls = !colored
              ? 'text-[#c8d0e0]'
              : isRatio
                ? ratioColor(v)
                : valColor(v, invert)
            return (
              <tr key={key} className="border-b border-border/40 hover:bg-card-raised transition-colors">
                <td className="py-2 pl-1 text-muted font-mono">{label}</td>
                <td className={`py-2 pr-1 text-right font-mono font-medium num ${colorCls}`}>
                  {fmt(v, pct)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Backtest metrics (Portfolio + Benchmark columns) ──────────────────────────

const BACKTEST_ROWS: {
  key: string; label: string; pct: boolean; colored: boolean; invert?: boolean; isRatio?: boolean
}[] = [
  { key: 'Annualized Return',     label: 'Ann. Return',     pct: true,  colored: true  },
  { key: 'Annualized Volatility', label: 'Ann. Volatility', pct: true,  colored: false },
  { key: 'Sharpe Ratio',          label: 'Sharpe',          pct: false, colored: true,  isRatio: true },
  { key: 'Sortino Ratio',         label: 'Sortino',         pct: false, colored: true,  isRatio: true },
  { key: 'Max Drawdown',          label: 'Max DD',          pct: true,  colored: true, invert: true },
  { key: 'Calmar Ratio',          label: 'Calmar',          pct: false, colored: true  },
  { key: 'VaR 95% (Historical)',  label: 'VaR 95%',         pct: true,  colored: true, invert: true },
  { key: 'CVaR 95% (Historical)', label: 'CVaR 95%',        pct: true,  colored: true, invert: true },
  { key: 'Win Rate',              label: 'Win Rate',        pct: true,  colored: false },
]

export function BacktestMetricsTable({
  metrics,
}: {
  metrics: Record<string, Record<string, number | null>>
}) {
  const columns = ['Portfolio', 'Benchmark'].filter(col =>
    Object.values(metrics).some(row => col in row),
  )

  const heroRet   = metrics['Annualized Return']?.['Portfolio'] ?? null
  const heroSR    = metrics['Sharpe Ratio']?.['Portfolio'] ?? null
  const heroBmRet = metrics['Annualized Return']?.['Benchmark'] ?? null
  const heroBmSR  = metrics['Sharpe Ratio']?.['Benchmark'] ?? null

  return (
    <div className="bg-card card-top-accent rounded-panel p-4 border border-border">
      <p className="terminal-label mb-3">Performance Metrics — Out-of-Sample</p>

      {/* Hero stat comparison */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Portfolio */}
        <div className="bg-[#07090f] rounded-panel p-3 border border-accent/20 card-accent-left">
          <p className="terminal-label text-accent mb-1.5">Portfolio</p>
          <p className={`text-lg font-mono font-semibold num ${heroRet != null && heroRet > 0 ? 'text-positive' : heroRet != null ? 'text-negative' : 'text-[#c8d0e0]'}`}>
            {fmt(heroRet, true)}
          </p>
          <p className={`text-xs font-mono num mt-0.5 ${ratioColor(heroSR)}`}>
            SR {fmt(heroSR, false)}
          </p>
        </div>
        {/* Benchmark */}
        {columns.includes('Benchmark') && (
          <div className="bg-[#07090f] rounded-panel p-3 border border-border">
            <p className="terminal-label mb-1.5">Benchmark EW</p>
            <p className={`text-lg font-mono font-semibold num ${heroBmRet != null && heroBmRet > 0 ? 'text-positive' : heroBmRet != null ? 'text-negative' : 'text-[#c8d0e0]'}`}>
              {fmt(heroBmRet, true)}
            </p>
            <p className={`text-xs font-mono num mt-0.5 ${ratioColor(heroBmSR)}`}>
              SR {fmt(heroBmSR, false)}
            </p>
          </div>
        )}
      </div>

      {/* Full table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-2 pl-1 text-left terminal-label">Metric</th>
            {columns.map(col => (
              <th key={col} className="pb-2 pr-1 text-right terminal-label">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BACKTEST_ROWS.map(({ key, label, pct, colored, invert, isRatio }) => {
            const row = metrics[key] ?? {}
            return (
              <tr key={key} className="border-b border-border/40 hover:bg-card-raised transition-colors">
                <td className="py-2 pl-1 text-muted font-mono">{label}</td>
                {columns.map(col => {
                  const v = row[col] ?? null
                  const colorCls = !colored
                    ? 'text-[#c8d0e0]'
                    : isRatio
                      ? ratioColor(v)
                      : valColor(v, invert)
                  return (
                    <td key={col} className={`py-2 pr-1 text-right font-mono font-medium num ${colorCls}`}>
                      {fmt(v, pct)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
