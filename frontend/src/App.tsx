import { useState } from 'react'
import { AssetSearch }  from './components/AssetSearch'
import { ConfigPanel }  from './components/ConfigPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { useOptimize }  from './hooks/useOptimize'
import { useBacktest }  from './hooks/useBacktest'
import type { TickerMatch, MuMethod, CovMethod, OptMethod } from './types'

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
      start:         startDate,
      end:           endDate,
      mu_method:     muMethod,
      cov_method:    covMethod,
      opt_method:    optMethod,
      target_return: isFrontier ? 'frontier' : null,
      constraints:   { max_weight: maxWeight, min_weight: minWeight },
      solver:        'CLARABEL',
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
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-border px-6 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center text-white text-sm font-bold shadow">
          P
        </div>
        <span className="font-semibold text-white">Portfolio Optimizer</span>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          {tickers.length > 0 && (
            <span className="bg-[#6366f120] border border-[#6366f140] text-[#6366f1] px-2.5 py-1 rounded-full font-medium">
              {tickers.length} asset{tickers.length !== 1 ? 's' : ''} selected
            </span>
          )}
          <span>FastAPI + CVXPY</span>
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

        <ConfigPanel
          muMethod={muMethod}
          covMethod={covMethod}
          optMethod={optMethod}
          isFrontier={isFrontier}
          maxWeight={maxWeight}
          minWeight={minWeight}
          estimationWindow={estimationWindow}
          rebalancingFreq={rebalancingFreq}
          onMuMethod={setMuMethod}
          onCovMethod={setCovMethod}
          onOptMethod={setOptMethod}
          onFrontierToggle={setIsFrontier}
          onMaxWeight={v => { setMaxWeight(v); if (v < minWeight) setMinWeight(v) }}
          onMinWeight={v => { setMinWeight(v); if (v > maxWeight) setMaxWeight(v) }}
          onEstimationWindow={setEstimationWindow}
          onRebalancingFreq={setRebalancingFreq}
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
      <footer className="border-t border-border mt-12 px-6 py-4 text-center text-xs text-muted">
        Portfolio Optimizer · React + Vite + Recharts · FastAPI + CVXPY backend
      </footer>
    </div>
  )
}
