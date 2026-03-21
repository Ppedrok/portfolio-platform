import { useState } from 'react'
import { AssetSearch }    from './components/AssetSearch'
import { AssetOverview }  from './components/AssetOverview'
import { ConfigPanel }    from './components/ConfigPanel'
import { ResultsPanel }   from './components/ResultsPanel'
import { useOptimize }  from './hooks/useOptimize'
import { useBacktest }  from './hooks/useBacktest'
import type { TickerMatch, MuMethod, CovMethod, OptMethod, ConstraintRow } from './types'

const TODAY = new Date().toISOString().slice(0, 10)

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
  const [constraints, setConstraints] = useState<ConstraintRow[]>([])
  const [longOnly,    setLongOnly]    = useState(true)

  // ── Results tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'optimization' | 'backtest'>('optimization')

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
      <header
        className="sticky top-0 z-40 px-6 py-3 flex items-center gap-3"
        style={{
          background: 'linear-gradient(180deg, #0d1420 0%, #0a0c12 100%)',
          borderBottom: '1px solid rgba(79, 142, 247, 0.15)',
        }}
      >
        {/* Logo mark */}
        <div className="w-7 h-7 rounded bg-accent flex items-center justify-center shrink-0 glow-accent">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <polyline points="1,12 5,6 9,9 13,3 15,5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="font-semibold text-[#e8eaf0] tracking-tight">Portfolio Optimizer</span>

        <div className="ml-auto flex items-center gap-3">
          {tickers.length > 0 && (
            <span className="font-mono text-xs bg-accent/10 border border-accent/20 text-accent px-2.5 py-1 rounded">
              {tickers.length} asset{tickers.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className="hidden sm:inline text-xs text-muted border border-border px-2.5 py-1 rounded font-mono">
            Powered by CVXPY + Riskfolio
          </span>
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
        />

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-12 px-6 py-3 flex items-center justify-center gap-4 text-[10px] text-muted font-mono">
        <span>Portfolio Optimizer</span>
        <span className="text-border">|</span>
        <span>React + Vite + Recharts</span>
        <span className="text-border">|</span>
        <span>FastAPI · CVXPY · Riskfolio-lib</span>
      </footer>
    </div>
  )
}
