import type { PortfolioMetrics } from '../types'

function fmt(v: number | null | undefined, isPercent: boolean): string {
  if (v == null) return '—'
  if (isPercent) return `${(v * 100).toFixed(2)}%`
  return v.toFixed(3)
}

function colorClass(v: number | null | undefined, invert = false): string {
  if (v == null) return 'text-white'
  const pos = invert ? v < 0 : v > 0
  return pos ? 'text-emerald-400' : 'text-red-400'
}

// ── Single portfolio metrics ───────────────────────────────────────────────────

const SINGLE_ROWS: { key: keyof PortfolioMetrics; label: string; pct: boolean; colored: boolean; invert?: boolean }[] = [
  { key: 'annualized_return',     label: 'Annualized Return',     pct: true,  colored: true  },
  { key: 'annualized_volatility', label: 'Annualized Volatility', pct: true,  colored: false },
  { key: 'sharpe_ratio',          label: 'Sharpe Ratio',          pct: false, colored: true  },
  { key: 'sortino_ratio',         label: 'Sortino Ratio',         pct: false, colored: true  },
  { key: 'max_drawdown',          label: 'Max Drawdown',          pct: true,  colored: true, invert: true },
  { key: 'calmar_ratio',          label: 'Calmar Ratio',          pct: false, colored: true  },
  { key: 'var_95',                label: 'VaR 95%',               pct: true,  colored: true, invert: true },
  { key: 'cvar_95',               label: 'CVaR 95%',              pct: true,  colored: true, invert: true },
  { key: 'win_rate',              label: 'Win Rate',              pct: true,  colored: false },
]

export function MetricsTable({ metrics }: { metrics: PortfolioMetrics }) {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-white mb-1">Performance Metrics</h3>
      <p className="text-xs text-muted mb-4">In-sample statistics</p>
      <table className="w-full text-sm">
        <tbody>
          {SINGLE_ROWS.map(({ key, label, pct, colored, invert }) => {
            const v = metrics[key]
            return (
              <tr key={key} className="border-t border-border">
                <td className="py-2.5 text-muted">{label}</td>
                <td className={`py-2.5 text-right font-medium tabular-nums ${
                  colored ? colorClass(v, invert) : 'text-white'
                }`}>
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

const BACKTEST_ROWS: { key: string; label: string; pct: boolean; colored: boolean; invert?: boolean }[] = [
  { key: 'Annualized Return',     label: 'Annualized Return',     pct: true,  colored: true  },
  { key: 'Annualized Volatility', label: 'Annualized Volatility', pct: true,  colored: false },
  { key: 'Sharpe Ratio',          label: 'Sharpe Ratio',          pct: false, colored: true  },
  { key: 'Sortino Ratio',         label: 'Sortino Ratio',         pct: false, colored: true  },
  { key: 'Max Drawdown',          label: 'Max Drawdown',          pct: true,  colored: true, invert: true },
  { key: 'Calmar Ratio',          label: 'Calmar Ratio',          pct: false, colored: true  },
  { key: 'VaR 95% (Historical)',  label: 'VaR 95%',               pct: true,  colored: true, invert: true },
  { key: 'CVaR 95% (Historical)', label: 'CVaR 95%',              pct: true,  colored: true, invert: true },
  { key: 'Win Rate',              label: 'Win Rate',              pct: true,  colored: false },
]

export function BacktestMetricsTable({
  metrics,
}: {
  metrics: Record<string, Record<string, number | null>>
}) {
  const columns = ['Portfolio', 'Benchmark'].filter(col =>
    Object.values(metrics).some(row => col in row),
  )

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-white mb-1">Performance Metrics</h3>
      <p className="text-xs text-muted mb-4">Out-of-sample statistics</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-3 text-left text-muted font-normal text-xs">Metric</th>
            {columns.map(col => (
              <th key={col} className="pb-3 text-right text-muted font-normal text-xs">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BACKTEST_ROWS.map(({ key, label, pct, colored, invert }) => {
            const row = metrics[key] ?? {}
            return (
              <tr key={key} className="border-t border-border">
                <td className="py-2.5 text-muted">{label}</td>
                {columns.map(col => {
                  const v = row[col] ?? null
                  return (
                    <td key={col} className={`py-2.5 text-right font-medium tabular-nums ${
                      colored ? colorClass(v, invert) : 'text-white'
                    }`}>
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
