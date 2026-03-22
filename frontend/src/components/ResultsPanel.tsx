import type { OptimizeResponse, FrontierResponse, BacktestResponse } from '../types'
import { WeightsChart }          from './WeightsChart'
import { FrontierChart }         from './FrontierChart'
import { EquityCurve }           from './EquityCurve'
import { BacktestMetricsTable } from './MetricsTable'
import { WeightsHeatmap }        from './WeightsHeatmap'
import { RiskDecomposition }     from './RiskDecomposition'

type Tab = 'optimization' | 'backtest'

interface Props {
  isFrontier:      boolean
  optimizeData:    OptimizeResponse | FrontierResponse | null
  backtestData:    BacktestResponse | null
  optimizeError:   string | null
  backtestError:   string | null
  optimizeLoading: boolean
  backtestLoading: boolean
  activeTab:       Tab
  onTabChange:     (t: Tab) => void
}

function isFrontierResponse(d: OptimizeResponse | FrontierResponse): d is FrontierResponse {
  return 'portfolios' in d
}

function Spinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <span className="text-muted text-xs font-mono uppercase tracking-widest">{message}</span>
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="bg-negative/8 border border-negative/25 rounded-panel p-4 text-xs font-mono text-negative leading-relaxed">
      <span className="font-semibold">ERROR: </span>{msg}
    </div>
  )
}

export function ResultsPanel({
  isFrontier,
  optimizeData, backtestData,
  optimizeError, backtestError,
  optimizeLoading, backtestLoading,
  activeTab, onTabChange,
}: Props) {
  const hasAny =
    optimizeData || backtestData ||
    optimizeLoading || backtestLoading ||
    optimizeError || backtestError

  if (!hasAny) return null

  return (
    <section className="bg-card rounded-panel p-5 shadow-card border border-border">
      {/* Section label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-mono font-semibold text-muted uppercase tracking-widest border border-border px-2 py-0.5 rounded">
          03
        </span>
        <h2 className="text-sm font-semibold text-[#e8eaf0] tracking-tight">Results Dashboard</h2>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-0 mb-5 border border-border rounded-panel overflow-hidden w-fit">
        {(['optimization', 'backtest'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-5 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'bg-accent text-white'
                : 'text-muted hover:text-[#e8eaf0] bg-bg'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Optimization tab ─────────────────────────────────────────────── */}
      {activeTab === 'optimization' && (
        <div>
          {optimizeLoading && <Spinner message="Optimising…" />}
          {!optimizeLoading && optimizeError && <ErrorBanner msg={optimizeError} />}
          {!optimizeLoading && !optimizeError && optimizeData && (
            isFrontierResponse(optimizeData) ? (
              <FrontierChart data={optimizeData} />
            ) : (() => {
              const od = optimizeData as OptimizeResponse
              return (
                <>
                  <WeightsChart weights={od.weights} metrics={od.metrics} />
                  {od.risk_decomposition && (
                    <RiskDecomposition data={od.risk_decomposition} />
                  )}
                </>
              )
            })()
          )}
        </div>
      )}

      {/* ── Backtest tab ─────────────────────────────────────────────────── */}
      {activeTab === 'backtest' && (
        <div className="space-y-4">
          {backtestLoading && <Spinner message="Running walk-forward backtest…" />}
          {!backtestLoading && backtestError && <ErrorBanner msg={backtestError} />}
          {!backtestLoading && !backtestError && backtestData && (
            <>
              <EquityCurve data={backtestData} />
              <BacktestMetricsTable metrics={backtestData.metrics} />
              <WeightsHeatmap data={backtestData} />
            </>
          )}
        </div>
      )}
    </section>
  )
}
