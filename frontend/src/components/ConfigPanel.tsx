import type { MuMethod, CovMethod, OptMethod, ConstraintRow, TickerMatch } from '../types'
import { ConstraintsPanel } from './ConstraintsPanel'

interface Props {
  muMethod:         MuMethod
  covMethod:        CovMethod
  optMethod:        OptMethod
  isFrontier:       boolean
  maxWeight:        number
  minWeight:        number
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

// ── Method definitions with human-readable labels ─────────────────────────────

const MU_METHODS: { value: MuMethod; label: string }[] = [
  { value: 'historical', label: 'Historical Mean' },
  { value: 'JS_1',       label: 'James-Stein (Target: Grand Mean)' },
  { value: 'JS_2',       label: 'James-Stein (Target: Min Variance)' },
  { value: 'JS_3',       label: 'James-Stein (Target: Equal Weights)' },
  { value: 'BS_1',       label: 'Bayes-Stein (Target: Grand Mean)' },
  { value: 'BS_2',       label: 'Bayes-Stein (Target: Min Variance)' },
  { value: 'BS_3',       label: 'Bayes-Stein (Target: Equal Weights)' },
  { value: 'BOP_1',      label: 'BOP Shrinkage (Target: Grand Mean)' },
  { value: 'BOP_2',      label: 'BOP Shrinkage (Target: Min Variance)' },
  { value: 'BOP_3',      label: 'BOP Shrinkage (Target: Equal Weights)' },
  { value: 'BL_standard', label: 'Black-Litterman (Standard)' },
]

const COV_METHODS: { value: CovMethod; label: string }[] = [
  { value: 'historical',      label: 'Sample Covariance' },
  { value: 'ledoit_wolf',     label: 'Ledoit-Wolf Shrinkage' },
  { value: 'oas',             label: 'Oracle Approximating Shrinkage (OAS)' },
  { value: 'shrunk',          label: 'Shrunk Covariance' },
  { value: 'denoised_fixed',  label: 'RMT Denoising (Fixed)' },
  { value: 'spectral',        label: 'RMT Denoising (Spectral)' },
  { value: 'graph_lasso',     label: 'Graphical Lasso (CV)' },
  { value: 'jlogo',           label: 'J-LoGo (Sparse Inverse)' },
]

const OPT_METHODS: { value: OptMethod; label: string }[] = [
  { value: 'markowitz',           label: 'Mean-Variance (Markowitz)' },
  { value: 'CVaR',                label: 'CVaR — Conditional Value at Risk' },
  { value: 'MAD',                 label: 'MAD — Mean Absolute Deviation' },
  { value: 'SMAD',                label: 'SMAD — Semi Mean Absolute Deviation' },
  { value: 'SemiVariance',        label: 'Semi-Variance (Downside Risk)' },
  { value: 'LowerPartialMoments', label: 'Lower Partial Moments' },
  { value: 'EVaR',                label: 'EVaR — Entropic Value at Risk' },
  { value: 'Ulcer',               label: 'Ulcer Index' },
  { value: 'GMD',                 label: 'GMD — Gini Mean Difference' },
]

// ── Shared sub-components ─────────────────────────────────────────────────────

const SELECT_CLS =
  'w-full bg-[#0d1117] border border-border rounded-panel px-3 py-2.5 text-xs text-[#e8eaf0] ' +
  'focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer hover:border-accent/50'

function LabeledSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label:    string
  value:    T
  options:  { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div>
      <label className="block text-[10px] text-muted mb-1 font-mono uppercase tracking-widest">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className={SELECT_CLS}
        style={{ colorScheme: 'dark' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
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
      <div className="flex justify-between mb-2">
        <span className="text-[10px] text-muted font-mono uppercase tracking-widest">{label}</span>
        <span className="text-xs text-accent font-mono font-semibold">{format(value)}</span>
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

// ── Main component ────────────────────────────────────────────────────────────

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
    <section className="bg-card rounded-panel p-5 shadow-card border border-border space-y-5">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono font-semibold text-accent uppercase tracking-widest border border-accent/30 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(79,142,247,0.3)]">
          02
        </span>
        <h2 className="text-sm font-semibold text-[#e8eaf0] tracking-tight">Configuration</h2>
      </div>

      {/* Method selects */}
      <div className="grid grid-cols-3 gap-3">
        <LabeledSelect label="Expected Returns"   value={muMethod}  options={MU_METHODS}  onChange={onMuMethod}  />
        <LabeledSelect label="Covariance Matrix"  value={covMethod} options={COV_METHODS} onChange={onCovMethod} />
        <LabeledSelect label="Optimization Method" value={optMethod} options={OPT_METHODS} onChange={onOptMethod} />
      </div>

      {/* Mode toggle */}
      <div>
        <span className="block text-[10px] text-muted mb-2 font-mono uppercase tracking-widest">
          Optimization Mode
        </span>
        <div className="inline-flex rounded-panel overflow-hidden border border-border bg-bg">
          {(['Single Portfolio', 'Efficient Frontier'] as const).map((label, i) => {
            const active = isFrontier === (i === 1)
            return (
              <button
                key={label}
                onClick={() => onFrontierToggle(i === 1)}
                className={`px-4 py-2 text-xs font-mono font-medium transition-colors ${
                  active
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-[#e8eaf0]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Weight constraints */}
      <div className="grid grid-cols-2 gap-5">
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
      <div className="border-t border-border pt-4 space-y-4">
        <span className="block text-[10px] text-muted font-mono uppercase tracking-widest">
          Backtest Settings
        </span>
        <div className="grid grid-cols-2 gap-5">
          <SliderRow
            label="Estimation Window"
            value={estimationWindow}
            min={60} max={504} step={21}
            format={v => `${v}d`}
            onChange={onEstimationWindow}
          />
          <SliderRow
            label="Rebalancing Freq"
            value={rebalancingFreq}
            min={5} max={63}
            format={v => `${v}d`}
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

      {/* Action buttons */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onOptimize}
          disabled={!canRun || optimizeLoading}
          className="flex-1 py-2.5 rounded-panel bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-mono font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 glow-accent hover:brightness-110 hover:shadow-[0_0_20px_rgba(79,142,247,0.45)]"
        >
          {optimizeLoading && <Spinner />}
          Optimize Portfolio
        </button>
        <button
          onClick={onBacktest}
          disabled={!canRun || backtestLoading}
          className="flex-1 py-2.5 rounded-panel border border-accent/60 hover:border-accent hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed text-accent text-xs font-mono font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_14px_rgba(79,142,247,0.25)]"
        >
          {backtestLoading && <Spinner />}
          Run Backtest
        </button>
      </div>
    </section>
  )
}
