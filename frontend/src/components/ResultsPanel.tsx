import type { OptimizeResponse, FrontierResponse, BacktestResponse } from '../types'
import { WeightsChart }          from './WeightsChart'
import { FrontierChart }         from './FrontierChart'
import { EquityCurve }           from './EquityCurve'
import { BacktestMetricsTable } from './MetricsTable'
import { WeightsHeatmap }        from './WeightsHeatmap'
import { RiskDecomposition }     from './RiskDecomposition'
import { FactorExposure }        from './FactorExposure'
import { SkeletonLoader, ProgressSteps } from './SkeletonLoader'
import type { ProgressStep } from './SkeletonLoader'

const OPTIMIZE_STEPS: ProgressStep[] = [
  { label: 'Downloading price data…',          delay: 1000  },
  { label: 'Estimating parameters (μ, Σ)…',    delay: 2000  },
  { label: 'Solving optimization problem…',     delay: 3500  },
  { label: 'Computing risk decomposition…',     delay: 4500  },
]

const BACKTEST_STEPS: ProgressStep[] = [
  { label: 'Downloading price data…',           delay: 1000  },
  { label: 'Initialising walk-forward folds…',  delay: 2500  },
  { label: 'Running rebalancing steps…',        delay: 5000  },
  { label: 'Aggregating equity curve…',         delay: 7000  },
]

type Tab = 'optimization' | 'backtest' | 'factors'

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
  // For factor exposure
  tickers:         string[]
  startDate:       string
  endDate:         string
}

function isFrontierResponse(d: OptimizeResponse | FrontierResponse): d is FrontierResponse {
  return 'portfolios' in d
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
  tickers, startDate, endDate,
}: Props) {
  const hasAny =
    optimizeData || backtestData ||
    optimizeLoading || backtestLoading ||
    optimizeError || backtestError ||
    tickers.length >= 2   // always show when assets are loaded (for Factor Exposure tab)

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
        {([
          { id: 'optimization', label: 'Optimization' },
          { id: 'backtest',     label: 'Backtest' },
          { id: 'factors',      label: 'Factor Exposure' },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`px-5 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
              activeTab === id
                ? 'bg-accent text-white'
                : 'text-muted hover:text-[#e8eaf0] bg-bg'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Optimization tab ─────────────────────────────────────────────── */}
      {activeTab === 'optimization' && (
        <div>
          {optimizeLoading && (
            <>
              <ProgressSteps loading={optimizeLoading} steps={OPTIMIZE_STEPS} />
              <SkeletonLoader variant="weights" />
            </>
          )}
          {!optimizeLoading && optimizeError && <ErrorBanner msg={optimizeError} />}
          {!optimizeLoading && !optimizeError && optimizeData && (
            isFrontierResponse(optimizeData) ? (
              <FrontierChart data={optimizeData} />
            ) : (() => {
              const od = optimizeData as OptimizeResponse
              return (
                <>
                  <WeightsChart weights={od.weights} metrics={od.metrics} risk_decomposition={od.risk_decomposition ?? undefined} />
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
          {backtestLoading && (
            <>
              <ProgressSteps loading={backtestLoading} steps={BACKTEST_STEPS} />
              <SkeletonLoader variant="backtest" />
            </>
          )}
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

      {/* ── Factor Exposure tab ──────────────────────────────────────────── */}
      {activeTab === 'factors' && (
        <FactorExposure
          tickers={tickers}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </section>
  )
}
