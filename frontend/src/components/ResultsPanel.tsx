import type { OptimizeResponse, FrontierResponse, BacktestResponse } from '../types'
import { WeightsChart }          from './WeightsChart'
import { FrontierChart }         from './FrontierChart'
import { EquityCurve }           from './EquityCurve'
import { BacktestMetricsTable } from './MetricsTable'
import { WeightsHeatmap }        from './WeightsHeatmap'
import { RiskDecomposition }     from './RiskDecomposition'
import { FactorExposure }        from './FactorExposure'
import { FrontierComparison }    from './FrontierComparison'
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

type Tab = 'optimization' | 'backtest' | 'factors' | 'compare'

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
  // For factor exposure & frontier comparison
  tickers:         string[]
  startDate:       string
  endDate:         string
  muMethod:        string
  covMethod:       string
  maxWeight:       number
  minWeight:       number
  longOnly:        boolean
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
  muMethod, covMethod,
  maxWeight, minWeight, longOnly,
}: Props) {
  const hasAny =
    optimizeData || backtestData ||
    optimizeLoading || backtestLoading ||
    optimizeError || backtestError ||
    tickers.length >= 2   // always show when assets are loaded (for Factor Exposure tab)

  if (!hasAny) return null

  return (
    <section className="bg-card card-top-accent rounded-panel p-5 border border-border">
      {/* Section label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="terminal-label border border-accent/40 text-accent bg-accent/5 px-2 py-0.5 rounded">
          03
        </span>
        <h2 className="text-sm font-semibold text-[#c8d0e0] uppercase tracking-wider">Results Dashboard</h2>
      </div>

      {/* Tab switcher — underline style */}
      <div className="flex border-b border-border mb-5 overflow-x-auto">
        {([
          { id: 'optimization', label: 'Optimization' },
          { id: 'backtest',     label: 'Backtest' },
          { id: 'factors',      label: 'Factor Exposure' },
          { id: 'compare',      label: 'Compare Frontiers' },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`px-5 py-2.5 text-[10px] font-mono uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === id
                ? 'border-accent text-[#e8eaf0] bg-accent/5'
                : 'border-transparent text-muted hover:text-muted-bright'
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
                  {od.warning && (
                    <div className="mb-4 bg-warning/10 border border-warning/30 rounded px-3 py-2 text-xs font-mono text-warning leading-relaxed">
                      {od.warning}
                    </div>
                  )}
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

      {/* ── Compare Frontiers tab ─────────────────────────────────────────── */}
      {activeTab === 'compare' && (
        <FrontierComparison
          tickers={tickers}
          startDate={startDate}
          endDate={endDate}
          muMethod={muMethod}
          covMethod={covMethod}
          maxWeight={maxWeight}
          minWeight={minWeight}
          longOnly={longOnly}
        />
      )}
    </section>
  )
}
