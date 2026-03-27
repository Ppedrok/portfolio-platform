import { useState, useEffect, useRef, useCallback } from 'react'
import { AssetSearch }    from './components/AssetSearch'
import { AssetOverview }  from './components/AssetOverview'
import { ConfigPanel }    from './components/ConfigPanel'
import { ResultsPanel }   from './components/ResultsPanel'
import { Documentation }  from './components/Documentation'
import { Sidebar }        from './components/Sidebar'
import { GlobalLoadingBar } from './components/GlobalLoadingBar'
import { useOptimize }    from './hooks/useOptimize'
import { useBacktest }    from './hooks/useBacktest'
import type {
  TickerMatch, MuMethod, CovMethod, OptMethod,
  ConstraintRow, AssetGroup, BLView, PortfolioSnapshot,
} from './types'
import type { SideSection } from './components/Sidebar'

const TODAY = new Date().toISOString().slice(0, 10)

// ── Live clock ─────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="font-mono text-[11px] text-muted-bright tabular-nums">
      {time.toUTCString().slice(17, 25)} UTC
    </span>
  )
}

// ── Section scroll helper ─────────────────────────────────────────────────────
function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── Tab type (kept in sync with ResultsPanel) ─────────────────────────────────
type ResultTab = 'optimization' | 'backtest' | 'factors' | 'compare' | 'snapshots'

// ── Sidebar section → ResultsPanel tab mapping ────────────────────────────────
const SECTION_TO_TAB: Partial<Record<SideSection, ResultTab>> = {
  results:  'optimization',
  backtest: 'backtest',
  analysis: 'factors',
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Asset selection ──────────────────────────────────────────────────────────
  const [selected,  setSelected]  = useState<TickerMatch[]>([])
  const [startDate, setStartDate] = useState('2019-01-01')
  const [endDate,   setEndDate]   = useState(TODAY)

  // ── Configuration ────────────────────────────────────────────────────────────
  const [muMethod,  setMuMethod]  = useState<MuMethod>('historical')
  const [covMethod, setCovMethod] = useState<CovMethod>('ledoit_wolf')
  const [optMethod, setOptMethod] = useState<OptMethod>('CVaR')
  const [isFrontier,       setIsFrontier]       = useState(false)
  const [targetReturn,     setTargetReturn]     = useState<number | null>(null)
  const [maxWeight,        setMaxWeight]        = useState(1.0)
  const [minWeight,        setMinWeight]        = useState(0.0)
  const [estimationWindow, setEstimationWindow] = useState(252)
  const [rebalancingFreq,  setRebalancingFreq]  = useState(21)
  const [constraints,  setConstraints]  = useState<ConstraintRow[]>([])
  const [assetGroups,  setAssetGroups]  = useState<AssetGroup[]>([])
  const [blViews,           setBlViews]           = useState<BLView[]>([])
  const [benchmarkTicker,   setBenchmarkTicker]   = useState<string>('')
  const [maxTrackingError,  setMaxTrackingError]  = useState<number | null>(null)
  const [longOnly,          setLongOnly]          = useState(true)

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [sideSection, setSideSection] = useState<SideSection>('universe')
  const [activeTab,   setActiveTab]   = useState<ResultTab>('optimization')

  // ── API hooks ────────────────────────────────────────────────────────────────
  const optimize = useOptimize()
  const backtest = useBacktest()

  // ── Snapshots (multi-portfolio comparison) ───────────────────────────────────
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([])

  function handleSaveSnapshot() {
    if (!backtest.data) return
    const data = backtest.data
    const last  = data.weights_history[data.weights_history.length - 1]
    const snap: PortfolioSnapshot = {
      id:           Date.now().toString(),
      label:        `${optMethod} — ${data.oos_start}`,
      savedAt:      new Date().toISOString(),
      optMethod,
      tickers:      data.tickers,
      oos_start:    data.oos_start,
      oos_end:      data.oos_end,
      equity_curve: data.equity_curve,
      metrics:      data.metrics,
      finalWeights: last?.weights ?? {},
      weightsHistory: data.weights_history,
      config: {
        trainStart:       startDate,
        trainEnd:         endDate,
        muMethod,
        covMethod,
        optMethod,
        estimationWindow,
        rebalancingFreq,
        longOnly,
        minWeight,
        maxWeight,
        benchmarkTicker,
        maxTrackingError,
        solver:           'CLARABEL',
      },
    }
    setSnapshots(prev => [...prev, snap])
    setActiveTab('snapshots')
    setSideSection('backtest')
  }

  const [compareLoading, setCompareLoading] = useState(false)
  const anyLoading = optimize.loading || backtest.loading || compareLoading
  const tickers    = selected.map(t => t.ticker)
  const canRun     = tickers.length >= 2 && startDate < endDate

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleOptimize() {
    optimize.run({
      tickers,
      start:          startDate,
      end:            endDate,
      mu_method:      muMethod,
      cov_method:     covMethod,
      opt_method:     optMethod,
      target_return:  isFrontier ? 'frontier' : targetReturn,
      constraints:    { max_weight: maxWeight, min_weight: minWeight },
      rp_constraints: constraints.length > 0 ? constraints : null,
      asset_groups:   assetGroups.length > 0 ? assetGroups : null,
      bl_views:         muMethod.startsWith('BL') && blViews.length > 0 ? blViews : null,
      benchmark_ticker:    benchmarkTicker ? benchmarkTicker.toUpperCase().trim() : undefined,
      max_tracking_error:  !optMethod.startsWith('TrackingError') && benchmarkTicker && maxTrackingError != null ? maxTrackingError : undefined,
      long_only:           longOnly,
      solver:         'CLARABEL',
    })
    setSideSection('results')
    setActiveTab('optimization')
    scrollToSection('results')
  }

  function handleBacktest() {
    backtest.run({
      tickers,
      start:              startDate,
      end:                endDate,
      mu_method:          muMethod,
      cov_method:         covMethod,
      opt_method:         optMethod,
      estimation_window:  estimationWindow,
      rebalancing_freq:   rebalancingFreq,
      solver:             'CLARABEL',
      constraints:        { max_weight: maxWeight, min_weight: minWeight },
      rp_constraints:     constraints.length > 0 ? constraints : null,
      asset_groups:       assetGroups.length > 0 ? assetGroups : null,
      long_only:          longOnly,
      benchmark_ticker:   benchmarkTicker ? benchmarkTicker.toUpperCase().trim() : undefined,
      max_tracking_error: !optMethod.startsWith('TrackingError') && benchmarkTicker && maxTrackingError != null ? maxTrackingError : undefined,
    })
    setSideSection('backtest')
    setActiveTab('backtest')
    scrollToSection('results')
  }

  // Sidebar navigation: scroll to section + set active tab if applicable
  const handleSideNav = useCallback((id: SideSection) => {
    setSideSection(id)
    const tab = SECTION_TO_TAB[id]
    if (tab) setActiveTab(tab)
    // Map section id to DOM anchor
    const anchor =
      id === 'results' || id === 'backtest' || id === 'analysis' ? 'results' : id
    scrollToSection(anchor)
  }, [])

  // Sync sidebar highlight when user clicks ResultsPanel tabs directly
  const handleTabChange = useCallback((t: ResultTab) => {
    setActiveTab(t)
    const map: Partial<Record<ResultTab, SideSection>> = {
      optimization: 'results',
      backtest:     'backtest',
      factors:      'analysis',
      compare:      'analysis',
      snapshots:    'backtest',
    }
    if (map[t]) setSideSection(map[t]!)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#070504' }}>

      {/* ── Global loading bar ── */}
      <GlobalLoadingBar loading={anyLoading} />

      {/* ── Sidebar ── */}
      <Sidebar
        active={sideSection}
        onNavigate={handleSideNav}
        hasData={tickers.length >= 2}
      />

      {/* ── Main area (offset by sidebar width) ── */}
      <div style={{ flex: 1, marginLeft: 210, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* ── Top bar ── */}
        <header className="header-surface sticky top-0 z-50 px-5 py-0 flex items-center gap-4 border-b border-border" style={{ height: 44 }}>

          {/* Universe chips */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {tickers.length > 0 ? (
              <>
                <span className="terminal-label shrink-0">Universe</span>
                <div className="flex gap-1 flex-wrap">
                  {tickers.slice(0, 8).map(t => (
                    <span key={t} className="text-[10px] font-mono text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded">
                      {t}
                    </span>
                  ))}
                  {tickers.length > 8 && (
                    <span className="text-[10px] font-mono text-muted">+{tickers.length - 8}</span>
                  )}
                </div>
              </>
            ) : (
              <span className="terminal-label opacity-40">No assets selected — search in Section 01</span>
            )}
          </div>

          {/* Right status */}
          <div className="flex items-center gap-4 shrink-0">
            <LiveClock />
            {anyLoading && (
              <span className="terminal-label text-accent border border-accent/30 bg-accent/5 px-2 py-0.5 rounded animate-pulse">
                COMPUTING…
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
              <span className="terminal-label text-positive">LIVE</span>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 px-6 py-8 space-y-6 max-w-5xl w-full mx-auto">

          {/* 01 — Universe */}
          <div id="universe">
            <AssetSearch
              selected={selected}
              onAdd={t => setSelected(prev =>
                prev.some(s => s.ticker === t.ticker) ? prev : [...prev, t]
              )}
              onRemove={ticker => setSelected(prev => prev.filter(t => t.ticker !== ticker))}
              startDate={startDate}
              endDate={endDate}
              onStartDate={setStartDate}
              onEndDate={setEndDate}
            />
            {selected.length >= 2 && (
              <div className="mt-5">
                <AssetOverview
                  selected={selected}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
            )}
          </div>

          {/* 02 — Configure */}
          <div id="configure">
            <ConfigPanel
              muMethod={muMethod}
              covMethod={covMethod}
              optMethod={optMethod}
              isFrontier={isFrontier}
              targetReturn={targetReturn}
              maxWeight={maxWeight}
              minWeight={minWeight}
              estimationWindow={estimationWindow}
              rebalancingFreq={rebalancingFreq}
              assets={selected}
              longOnly={longOnly}
              onMuMethod={setMuMethod}
              onCovMethod={setCovMethod}
              onOptMethod={setOptMethod}
              onFrontierToggle={v => { setIsFrontier(v); if (v) setTargetReturn(null) }}
              onTargetReturn={setTargetReturn}
              onMaxWeight={v => { setMaxWeight(v); if (v < minWeight) setMinWeight(v) }}
              onMinWeight={v => { setMinWeight(v); if (v > maxWeight) setMaxWeight(v) }}
              onEstimationWindow={setEstimationWindow}
              onRebalancingFreq={setRebalancingFreq}
              onConstraintsChange={setConstraints}
              onGroupsChange={setAssetGroups}
              blViews={blViews}
              onBlViewsChange={setBlViews}
              benchmarkTicker={benchmarkTicker}
              onBenchmarkTicker={setBenchmarkTicker}
              maxTrackingError={maxTrackingError}
              onMaxTrackingError={setMaxTrackingError}
              onLongOnly={setLongOnly}
              onOptimize={handleOptimize}
              onBacktest={handleBacktest}
              canRun={canRun}
              optimizeLoading={optimize.loading}
              backtestLoading={backtest.loading}
            />
          </div>

          {/* 03-05 — Results (optimization + backtest + analysis tabs) */}
          <div id="results">
            <ResultsPanel
              isFrontier={isFrontier}
              optimizeData={optimize.data}
              backtestData={backtest.data}
              optimizeError={optimize.error}
              backtestError={backtest.error}
              optimizeLoading={optimize.loading}
              backtestLoading={backtest.loading}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              tickers={tickers}
              assets={selected}
              startDate={startDate}
              endDate={endDate}
              muMethod={muMethod}
              covMethod={covMethod}
              optMethod={optMethod}
              maxWeight={maxWeight}
              minWeight={minWeight}
              longOnly={longOnly}
              onCompareLoading={setCompareLoading}
              snapshots={snapshots}
              onSaveSnapshot={handleSaveSnapshot}
              onDeleteSnapshot={id => setSnapshots(prev => prev.filter(s => s.id !== id))}
              onClearSnapshots={() => setSnapshots([])}
            />
          </div>

          {/* 06 — Documentation */}
          <div id="docs">
            <Documentation />
          </div>

        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-border px-6 py-3 flex items-center justify-between bg-header text-[9px] font-mono text-muted tracking-wider uppercase">
          <span>
            <span className="text-accent font-semibold">Alessandro Pedrini</span>
            <span className="mx-2 text-muted/40">·</span>
            PortfolioOS — Institutional Grade Portfolio Analysis
          </span>
          <span>React · FastAPI · CVXPY · Riskfolio-Lib · Fama-French</span>
        </footer>

      </div>
    </div>
  )
}
