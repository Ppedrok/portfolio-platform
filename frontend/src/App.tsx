import { useState, useEffect } from 'react'
import { AssetSearch }    from './components/AssetSearch'
import { AssetOverview }  from './components/AssetOverview'
import { ConfigPanel }    from './components/ConfigPanel'
import { ResultsPanel }   from './components/ResultsPanel'
import { useOptimize }  from './hooks/useOptimize'
import { useBacktest }  from './hooks/useBacktest'
import type { TickerMatch, MuMethod, CovMethod, OptMethod, ConstraintRow, AssetGroup, BLView } from './types'

const TODAY = new Date().toISOString().slice(0, 10)

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

export default function App() {
  // ── Asset selection ─────────────────────────────────────────────────────────
  const [selected,  setSelected]  = useState<TickerMatch[]>([])
  const [startDate, setStartDate] = useState('2019-01-01')
  const [endDate,   setEndDate]   = useState(TODAY)

  // ── Configuration ───────────────────────────────────────────────────────────
  const [muMethod,  setMuMethod]  = useState<MuMethod>('historical')
  const [covMethod, setCovMethod] = useState<CovMethod>('ledoit_wolf')
  const [optMethod, setOptMethod] = useState<OptMethod>('CVaR')
  const [isFrontier, setIsFrontier] = useState(false)
  const [maxWeight,  setMaxWeight]  = useState(1.0)
  const [minWeight,  setMinWeight]  = useState(0.0)
  const [estimationWindow, setEstimationWindow] = useState(252)
  const [rebalancingFreq,  setRebalancingFreq]  = useState(21)
  const [constraints,  setConstraints]  = useState<ConstraintRow[]>([])
  const [assetGroups,  setAssetGroups]  = useState<AssetGroup[]>([])
  const [blViews,      setBlViews]      = useState<BLView[]>([])
  const [longOnly,     setLongOnly]     = useState(true)

  // ── Results tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'optimization' | 'backtest' | 'factors'>('optimization')

  // ── API hooks ───────────────────────────────────────────────────────────────
  const optimize = useOptimize()
  const backtest = useBacktest()

  const tickers = selected.map(t => t.ticker)
  const canRun  = tickers.length >= 2 && startDate < endDate

  function handleOptimize() {
    optimize.run({
      tickers,
      start:          startDate,
      end:            endDate,
      mu_method:      muMethod,
      cov_method:     covMethod,
      opt_method:     optMethod,
      target_return:  isFrontier ? 'frontier' : null,
      constraints:    { max_weight: maxWeight, min_weight: minWeight },
      rp_constraints: constraints.length > 0 ? constraints : null,
      asset_groups:   assetGroups.length > 0 ? assetGroups : null,
      bl_views:       muMethod.startsWith('BL') && blViews.length > 0 ? blViews : null,
      long_only:      longOnly,
      solver:         'CLARABEL',
    })
    setActiveTab('optimization')
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
    })
    setActiveTab('backtest')
  }

  return (
    <div className="min-h-screen bg-bg font-sans text-white">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="header-surface sticky top-0 z-50 px-6 py-0 flex items-stretch gap-0">
        {/* Logo block */}
        <div className="flex items-center gap-3 pr-6 border-r border-border py-3">
          <div className="w-7 h-7 rounded bg-accent flex items-center justify-center shrink-0 glow-accent">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 10 L4 6 L7 8 L10 3 L13 5" stroke="white" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#e8eaf0] tracking-widest uppercase font-mono">
              PortfolioOS
            </div>
            <div className="terminal-label tracking-wider">
              QUANT PLATFORM
            </div>
          </div>
        </div>

        {/* Universe chips */}
        <div className="flex items-center gap-3 px-6 border-r border-border py-3">
          {tickers.length > 0 && (
            <>
              <span className="terminal-label">Universe</span>
              <div className="flex gap-1 flex-wrap">
                {tickers.slice(0, 6).map(t => (
                  <span key={t} className="text-[10px] font-mono text-teal bg-teal/10 border border-teal/20 px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
                {tickers.length > 6 && (
                  <span className="text-[10px] font-mono text-muted">+{tickers.length - 6}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-4 py-3">
          <LiveClock />
          <span className="terminal-label border border-border px-2 py-1 rounded hidden sm:inline">
            CVXPY · RISKFOLIO-LIB
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
            <span className="terminal-label text-positive">LIVE</span>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        <AssetSearch
          selected={selected}
          onAdd={t => setSelected(prev => {
            if (prev.some(s => s.ticker === t.ticker)) return prev
            return [...prev, t]
          })}
          onRemove={ticker => setSelected(prev => prev.filter(t => t.ticker !== ticker))}
          startDate={startDate}
          endDate={endDate}
          onStartDate={setStartDate}
          onEndDate={setEndDate}
        />

        {selected.length >= 2 && (
          <AssetOverview
            selected={selected}
            startDate={startDate}
            endDate={endDate}
          />
        )}

        <ConfigPanel
          muMethod={muMethod}
          covMethod={covMethod}
          optMethod={optMethod}
          isFrontier={isFrontier}
          maxWeight={maxWeight}
          minWeight={minWeight}
          estimationWindow={estimationWindow}
          rebalancingFreq={rebalancingFreq}
          assets={selected}
          longOnly={longOnly}
          onMuMethod={setMuMethod}
          onCovMethod={setCovMethod}
          onOptMethod={setOptMethod}
          onFrontierToggle={setIsFrontier}
          onMaxWeight={v => { setMaxWeight(v); if (v < minWeight) setMinWeight(v) }}
          onMinWeight={v => { setMinWeight(v); if (v > maxWeight) setMaxWeight(v) }}
          onEstimationWindow={setEstimationWindow}
          onRebalancingFreq={setRebalancingFreq}
          onConstraintsChange={setConstraints}
          onGroupsChange={setAssetGroups}
          blViews={blViews}
          onBlViewsChange={setBlViews}
          onLongOnly={setLongOnly}
          onOptimize={handleOptimize}
          onBacktest={handleBacktest}
          canRun={canRun}
          optimizeLoading={optimize.loading}
          backtestLoading={backtest.loading}
        />

        <ResultsPanel
          isFrontier={isFrontier}
          optimizeData={optimize.data}
          backtestData={backtest.data}
          optimizeError={optimize.error}
          backtestError={backtest.error}
          optimizeLoading={optimize.loading}
          backtestLoading={backtest.loading}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tickers={tickers}
          startDate={startDate}
          endDate={endDate}
        />

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-16 px-6 py-3 flex items-center justify-between bg-header text-[9px] font-mono text-muted tracking-wider uppercase">
        <span>© 2025 PORTFOLIOOS — INSTITUTIONAL GRADE PORTFOLIO ANALYSIS</span>
        <span>REACT + FASTAPI + CVXPY + RISKFOLIO-LIB + FAMA-FRENCH</span>
      </footer>
    </div>
  )
}
