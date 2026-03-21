import type { OptimizeResponse, FrontierResponse, BacktestResponse } from '../types'
import { WeightsChart }          from './WeightsChart'
import { FrontierChart }         from './FrontierChart'
import { EquityCurve }           from './EquityCurve'
import { MetricsTable, BacktestMetricsTable } from './MetricsTable'
import { WeightsHeatmap }        from './WeightsHeatmap'

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
      <svg className="animate-spin h-10 w-10 text-[#6366f1]" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <span className="text-muted text-sm">{message}</span>
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 text-sm text-red-400 leading-relaxed">
      <span className="font-semibold">Error: </span>{msg}
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
    <section className="bg-card rounded-2xl p-6 shadow-card border border-border">
      {/* Section header */}
      <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-5">
        <span className="w-6 h-6 rounded-md bg-[#6366f120] flex items-center justify-center text-[#6366f1] text-xs font-bold">3</span>
        Results Dashboard
      </h2>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 bg-bg rounded-xl p-1 w-fit border border-border">
        {(['optimization', 'backtest'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-[#6366f1] text-white shadow'
                : 'text-muted hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Optimization tab ────────────────────────────────────────────── */}
      {activeTab === 'optimization' && (
        <div>
          {optimizeLoading && <Spinner message="Optimising portfolio…" />}
          {!optimizeLoading && optimizeError && <ErrorBanner msg={optimizeError} />}
          {!optimizeLoading && !optimizeError && optimizeData && (
            isFrontierResponse(optimizeData) ? (
              <FrontierChart data={optimizeData} />
            ) : (
              <div className="grid grid-cols-2 gap-5">
                <WeightsChart weights={(optimizeData as OptimizeResponse).weights} />
                <MetricsTable metrics={(optimizeData as OptimizeResponse).metrics} />
              </div>
            )
          )}
        </div>
      )}

      {/* ── Backtest tab ─────────────────────────────────────────────────── */}
      {activeTab === 'backtest' && (
        <div className="space-y-5">
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
