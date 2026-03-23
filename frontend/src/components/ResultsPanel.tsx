import type {
  OptimizeResponse, FrontierResponse, BacktestResponse,
  TickerMatch, PortfolioSnapshot,
} from '../types'
import { WeightsChart }          from './WeightsChart'
import { FrontierChart }         from './FrontierChart'
import { EquityCurve }           from './EquityCurve'
import { BacktestMetricsTable }  from './MetricsTable'
import { WeightsHeatmap }        from './WeightsHeatmap'
import { RollingCharts }         from './RollingCharts'
import { WeightsTimeline }       from './WeightsTimeline'
import { RiskDecomposition }     from './RiskDecomposition'
import { FactorExposure }        from './FactorExposure'
import { FrontierComparison }    from './FrontierComparison'
import { PortfolioComparison }   from './PortfolioComparison'
import { ReportExportButton }    from './ReportExport'
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

type Tab = 'optimization' | 'backtest' | 'factors' | 'compare' | 'snapshots'

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
  assets:          TickerMatch[]
  startDate:       string
  endDate:         string
  muMethod:        string
  covMethod:       string
  optMethod:       string
  maxWeight:       number
  minWeight:       number
  longOnly:        boolean
  onCompareLoading?: (loading: boolean) => void
  // Snapshot management
  snapshots:         PortfolioSnapshot[]
  onSaveSnapshot:    () => void
  onDeleteSnapshot:  (id: string) => void
  onClearSnapshots:  () => void
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
  tickers, assets, startDate, endDate,
  muMethod, covMethod, optMethod,
  maxWeight, minWeight, longOnly,
  onCompareLoading,
  snapshots, onSaveSnapshot, onDeleteSnapshot, onClearSnapshots,
}: Props) {
  const hasAny =
    optimizeData || backtestData ||
    optimizeLoading || backtestLoading ||
    optimizeError || backtestError ||
    tickers.length >= 2

  if (!hasAny) return null

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'optimization', label: 'Optimization' },
    { id: 'backtest',     label: 'Backtest' },
    { id: 'factors',      label: 'Factor Exposure' },
    { id: 'compare',      label: 'Compare Frontiers' },
    { id: 'snapshots',    label: 'Snapshots', badge: snapshots.length > 0 ? snapshots.length : undefined },
  ]

  return (
    <section className="bg-card card-top-accent rounded-panel p-5 border border-border">
      {/* Section label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="terminal-label border border-accent/40 text-accent bg-accent/5 px-2 py-0.5 rounded">
          03
        </span>
        <h2 className="text-sm font-semibold text-[#c8d0e0] uppercase tracking-wider">Results Dashboard</h2>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-border mb-5 overflow-x-auto">
        {TABS.map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`px-5 py-2.5 text-[10px] font-mono uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap relative ${
              activeTab === id
                ? 'border-accent text-[#e8eaf0] bg-accent/5'
                : 'border-transparent text-muted hover:text-muted-bright'
            }`}
          >
            {label}
            {badge !== undefined && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent text-[8px] font-bold text-white">
                {badge}
              </span>
            )}
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
                  {/* Export button */}
                  <div className="flex justify-end mb-3">
                    <ReportExportButton
                      type="optimization"
                      assets={assets}
                      startDate={startDate}
                      endDate={endDate}
                      optMethod={optMethod}
                      muMethod={muMethod}
                      covMethod={covMethod}
                      optimizeData={od}
                    />
                  </div>
                  <WeightsChart
                    weights={od.weights}
                    metrics={od.metrics}
                    risk_decomposition={od.risk_decomposition ?? undefined}
                    assets={assets}
                  />
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
              {/* Action bar */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono text-muted">
                  {backtestData.rebalancing_steps} rebalancings ·&nbsp;
                  {backtestData.oos_start} → {backtestData.oos_end}
                </p>
                <div className="flex items-center gap-2">
                  {/* Save snapshot */}
                  <button
                    onClick={onSaveSnapshot}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold
                               text-accent border border-accent/30 bg-accent/5
                               hover:bg-accent/10 transition-all"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17,21 17,13 7,13 7,21"/>
                      <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    Save Snapshot
                  </button>
                  {/* Export PDF */}
                  <ReportExportButton
                    type="backtest"
                    assets={assets}
                    startDate={startDate}
                    endDate={endDate}
                    optMethod={optMethod}
                    muMethod={muMethod}
                    covMethod={covMethod}
                    backtestData={backtestData}
                  />
                </div>
              </div>

              {/* Charts */}
              <EquityCurve data={backtestData} />
              <RollingCharts data={backtestData} />
              <WeightsTimeline data={backtestData} assets={assets} />
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
          onLoadingChange={onCompareLoading}
        />
      )}

      {/* ── Snapshots comparison tab ──────────────────────────────────────── */}
      {activeTab === 'snapshots' && (
        <PortfolioComparison
          snapshots={snapshots}
          onDelete={onDeleteSnapshot}
          onClear={onClearSnapshots}
        />
      )}
    </section>
  )
}
