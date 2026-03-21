import type { MuMethod, CovMethod, OptMethod, ConstraintRow, TickerMatch } from '../types'
import { ConstraintsPanel } from './ConstraintsPanel'

interface Props {
  muMethod:         MuMethod
  covMethod:        CovMethod
  optMethod:        OptMethod
  isFrontier:       boolean
  maxWeight:        number     // 0–1
  minWeight:        number     // 0–1
  estimationWindow: number
  rebalancingFreq:  number
  assets:           TickerMatch[]
  longOnly:         boolean
  onMuMethod:             (v: MuMethod) => void
  onCovMethod:            (v: CovMethod) => void
  onOptMethod:            (v: OptMethod) => void
  onFrontierToggle:       (v: boolean) => void
  onMaxWeight:            (v: number) => void
  onMinWeight:            (v: number) => void
  onEstimationWindow:     (v: number) => void
  onRebalancingFreq:      (v: number) => void
  onConstraintsChange:    (rows: ConstraintRow[]) => void
  onLongOnly:             (v: boolean) => void
  onOptimize:      () => void
  onBacktest:      () => void
  canRun:          boolean
  optimizeLoading: boolean
  backtestLoading: boolean
}

const MU_METHODS: MuMethod[] = [
  'historical', 'JS_1', 'JS_2', 'JS_3',
  'BS_1', 'BS_2', 'BS_3',
  'BOP_1', 'BOP_2', 'BOP_3',
  'BL_standard',
]

const COV_METHODS: CovMethod[] = [
  'historical', 'ledoit_wolf', 'oas', 'shrunk',
  'denoised_fixed', 'spectral', 'graph_lasso', 'jlogo',
]

const OPT_METHODS: OptMethod[] = [
  'markowitz', 'CVaR', 'MAD', 'SMAD', 'SemiVariance',
  'LowerPartialMoments', 'EVaR', 'Ulcer', 'GMD',
]

// Generic select component
function Select<T extends string>({
  label, value, options, onChange,
}: {
  label:    string
  value:    T
  options:  T[]
  onChange: (v: T) => void
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1.5 font-medium uppercase tracking-wide">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#6366f1] transition-colors appearance-none cursor-pointer"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function SliderRow({
  label, value, min, max, step = 1, format, onChange,
}: {
  label:    string
  value:    number
  min:      number
  max:      number
  step?:    number
  format:   (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-muted font-medium uppercase tracking-wide">{label}</span>
        <span className="text-white font-semibold">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export function ConfigPanel({
  muMethod, covMethod, optMethod, isFrontier,
  maxWeight, minWeight, estimationWindow, rebalancingFreq,
  assets, longOnly,
  onMuMethod, onCovMethod, onOptMethod, onFrontierToggle,
  onMaxWeight, onMinWeight, onEstimationWindow, onRebalancingFreq,
  onConstraintsChange, onLongOnly,
  onOptimize, onBacktest, canRun, optimizeLoading, backtestLoading,
}: Props) {
  return (
    <section className="bg-card rounded-2xl p-6 shadow-card border border-border space-y-6">
      <h2 className="text-base font-semibold text-white flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-[#6366f120] flex items-center justify-center text-[#6366f1] text-xs font-bold">2</span>
        Configuration
      </h2>

      {/* Method selects */}
      <div className="grid grid-cols-3 gap-4">
        <Select label="Expected Returns" value={muMethod}  options={MU_METHODS}  onChange={onMuMethod}  />
        <Select label="Covariance"       value={covMethod} options={COV_METHODS} onChange={onCovMethod} />
        <Select label="Optimization"     value={optMethod} options={OPT_METHODS} onChange={onOptMethod} />
      </div>

      {/* Mode toggle */}
      <div>
        <span className="block text-xs text-muted mb-2 font-medium uppercase tracking-wide">
          Optimization Mode
        </span>
        <div className="inline-flex rounded-xl overflow-hidden border border-border bg-bg">
          {(['Single Portfolio', 'Efficient Frontier'] as const).map((label, i) => {
            const active = isFrontier === (i === 1)
            return (
              <button
                key={label}
                onClick={() => onFrontierToggle(i === 1)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#6366f1] text-white'
                    : 'text-muted hover:text-white'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Weight constraints */}
      <div className="grid grid-cols-2 gap-6">
        <SliderRow
          label="Max Weight / Asset"
          value={Math.round(maxWeight * 100)}
          min={Math.max(1, Math.ceil(minWeight * 100))}
          max={100}
          format={v => `${v}%`}
          onChange={v => onMaxWeight(v / 100)}
        />
        <SliderRow
          label="Min Weight / Asset"
          value={Math.round(minWeight * 100)}
          min={0}
          max={Math.min(30, Math.floor(maxWeight * 100))}
          format={v => `${v}%`}
          onChange={v => onMinWeight(v / 100)}
        />
      </div>

      {/* Backtest settings */}
      <div className="border-t border-border pt-5 space-y-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest">
          Backtest Settings
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <SliderRow
            label="Estimation Window"
            value={estimationWindow}
            min={60} max={504} step={21}
            format={v => `${v} days`}
            onChange={onEstimationWindow}
          />
          <SliderRow
            label="Rebalancing Frequency"
            value={rebalancingFreq}
            min={5} max={63}
            format={v => `${v} days`}
            onChange={onRebalancingFreq}
          />
        </div>
      </div>

      {/* Constraints panel */}
      <ConstraintsPanel
        assets={assets}
        longOnly={longOnly}
        onChange={onConstraintsChange}
        onLongOnly={onLongOnly}
      />

      {/* Buttons */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onOptimize}
          disabled={!canRun || optimizeLoading}
          className="flex-1 py-3 rounded-xl bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {optimizeLoading && <Spinner />}
          Optimize Portfolio
        </button>
        <button
          onClick={onBacktest}
          disabled={!canRun || backtestLoading}
          className="flex-1 py-3 rounded-xl border border-[#6366f1] hover:bg-[#6366f120] disabled:opacity-40 disabled:cursor-not-allowed text-[#6366f1] text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {backtestLoading && <Spinner />}
          Run Backtest
        </button>
      </div>
    </section>
  )
}
