import type { MuMethod, CovMethod, OptMethod, ConstraintRow, TickerMatch, AssetGroup, BLView } from '../types'
import { ConstraintsPanel } from './ConstraintsPanel'
import { BLViewsPanel }    from './BLViewsPanel'

interface Props {
  muMethod:         MuMethod
  covMethod:        CovMethod
  optMethod:        OptMethod
  isFrontier:       boolean
  targetReturn:     number | null
  maxWeight:        number
  minWeight:        number
  estimationWindow: number
  rebalancingFreq:  number
  assets:           TickerMatch[]
  longOnly:         boolean
  blViews:          BLView[]
  benchmarkTicker:   string
  onBenchmarkTicker: (v: string) => void
  maxTrackingError:  number | null
  onMaxTrackingError: (v: number | null) => void
  onMuMethod:             (v: MuMethod) => void
  onCovMethod:            (v: CovMethod) => void
  onOptMethod:            (v: OptMethod) => void
  onFrontierToggle:       (v: boolean) => void
  onTargetReturn:         (v: number | null) => void
  onMaxWeight:            (v: number) => void
  onMinWeight:            (v: number) => void
  onEstimationWindow:     (v: number) => void
  onRebalancingFreq:      (v: number) => void
  onConstraintsChange:    (rows: ConstraintRow[]) => void
  onGroupsChange:         (groups: AssetGroup[]) => void
  onLongOnly:             (v: boolean) => void
  onBlViewsChange:        (views: BLView[]) => void
  onOptimize:      () => void
  onBacktest:      () => void
  canRun:          boolean
  optimizeLoading: boolean
  backtestLoading: boolean
}

// ── Method definitions with human-readable labels ─────────────────────────────

const MU_METHODS: { value: MuMethod; label: string; group?: string }[] = [
  // ── Shrinkage / Bayesian
  { value: 'historical',  label: 'Historical Mean',                      group: 'Classical' },
  { value: 'JS_1',        label: 'James-Stein (Grand Mean)',              group: 'Shrinkage' },
  { value: 'JS_2',        label: 'James-Stein (Min Variance)',            group: 'Shrinkage' },
  { value: 'JS_3',        label: 'James-Stein (Equal Weights)',           group: 'Shrinkage' },
  { value: 'BS_1',        label: 'Bayes-Stein (Grand Mean)',              group: 'Shrinkage' },
  { value: 'BS_2',        label: 'Bayes-Stein (Min Variance)',            group: 'Shrinkage' },
  { value: 'BS_3',        label: 'Bayes-Stein (Equal Weights)',           group: 'Shrinkage' },
  { value: 'BOP_1',       label: 'BOP Shrinkage (Grand Mean)',            group: 'Shrinkage' },
  { value: 'BOP_2',       label: 'BOP Shrinkage (Min Variance)',          group: 'Shrinkage' },
  { value: 'BOP_3',       label: 'BOP Shrinkage (Equal Weights)',         group: 'Shrinkage' },
  { value: 'BL_standard', label: 'Black-Litterman (Standard)',            group: 'Black-Litterman' },
  // ── Factor models
  { value: 'FF3_mu',      label: 'Fama-French 3-Factor (μ)',              group: 'Factor Models' },
  { value: 'FF5_mu',      label: 'Fama-French 5-Factor (μ)',              group: 'Factor Models' },
  { value: 'Carhart4_mu', label: 'Carhart 4-Factor (μ)',                  group: 'Factor Models' },
]

const COV_METHODS: { value: CovMethod; label: string; group?: string }[] = [
  // ── Classical / shrinkage
  { value: 'historical',      label: 'Sample Covariance',                group: 'Classical' },
  { value: 'ledoit_wolf',     label: 'Ledoit-Wolf Shrinkage',            group: 'Shrinkage' },
  { value: 'oas',             label: 'Oracle Approximating (OAS)',        group: 'Shrinkage' },
  { value: 'shrunk',          label: 'Shrunk Covariance',                group: 'Shrinkage' },
  { value: 'denoised_fixed',  label: 'RMT Denoising (Fixed)',            group: 'RMT' },
  { value: 'spectral',        label: 'RMT Denoising (Spectral)',         group: 'RMT' },
  { value: 'graph_lasso',     label: 'Graphical Lasso (CV)',             group: 'Sparse' },
  { value: 'jlogo',           label: 'J-LoGo (Sparse Inverse)',          group: 'Sparse' },
  // ── Factor models
  { value: 'FF3_cov',         label: 'Fama-French 3-Factor (Σ)',         group: 'Factor Models' },
  { value: 'FF5_cov',         label: 'Fama-French 5-Factor (Σ)',         group: 'Factor Models' },
  { value: 'Carhart4_cov',    label: 'Carhart 4-Factor (Σ)',             group: 'Factor Models' },
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
  { value: 'GMD',                 label: 'GMD — Gini Mean Difference (slow)' },
  { value: 'Brownian',            label: 'Brownian Motion Distance (slow)' },
  { value: 'TrackingError_L2',    label: 'Index Tracking (L2)' },
  { value: 'TrackingError_L1',    label: 'Index Tracking (L1 robust)' },
  { value: 'TrackingError_Cov',   label: 'Index Tracking (Covariance)' },
]

// ── Shared sub-components ─────────────────────────────────────────────────────

const SELECT_CLS =
  'w-full bg-[#07090f] border border-border rounded-panel px-3 py-2.5 text-xs text-[#c8d0e0] ' +
  'focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer hover:border-border-bright'

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
  muMethod, covMethod, optMethod, isFrontier, targetReturn,
  maxWeight, minWeight, estimationWindow, rebalancingFreq,
  assets, longOnly, blViews, benchmarkTicker, onBenchmarkTicker,
  maxTrackingError, onMaxTrackingError,
  onMuMethod, onCovMethod, onOptMethod, onFrontierToggle, onTargetReturn,
  onMaxWeight, onMinWeight, onEstimationWindow, onRebalancingFreq,
  onConstraintsChange, onGroupsChange, onLongOnly, onBlViewsChange,
  onOptimize, onBacktest, canRun, optimizeLoading, backtestLoading,
}: Props) {
  const isBL       = muMethod.startsWith('BL')
  const isTracking = optMethod.startsWith('TrackingError')
  return (
    <section className="bg-card card-top-accent rounded-panel p-5 border border-border space-y-5">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <span className="terminal-label border border-accent/40 text-accent bg-accent/5 px-2 py-0.5 rounded">
          02
        </span>
        <h2 className="text-sm font-semibold text-[#c8d0e0] uppercase tracking-wider">Configuration</h2>
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

      {/* Benchmark ticker — always visible; mandatory for TrackingError, optional TE constraint for all other methods */}
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] text-muted mb-1 font-mono uppercase tracking-widest">
            Benchmark Ticker
            {isTracking && <span className="ml-1 text-warning/70">(required)</span>}
          </label>
          <input
            type="text"
            placeholder="SPY"
            value={benchmarkTicker}
            onChange={e => { onBenchmarkTicker(e.target.value.toUpperCase().trim()); if (!e.target.value) onMaxTrackingError(null) }}
            className="w-full bg-[#07090f] border border-border rounded-panel px-3 py-2.5 text-xs text-[#c8d0e0] font-mono focus:outline-none focus:border-accent transition-colors hover:border-border-bright placeholder-[#5a6a85]"
          />
          <p className="text-[9px] font-mono text-muted mt-1.5 italic">
            {isTracking
              ? 'Required for Index Tracking methods. The portfolio minimises tracking error vs this index.'
              : 'Optional. Set a benchmark to add a Tracking Error constraint to any optimisation method.'}
          </p>
        </div>

        {/* TE constraint — shown when benchmark is set and NOT a standalone TE method */}
        {benchmarkTicker && !isTracking && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted font-mono uppercase tracking-widest">
                  Max Tracking Error (Ann. %)
                </label>
                {maxTrackingError !== null && (
                  <button
                    type="button"
                    onClick={() => onMaxTrackingError(null)}
                    className="text-[9px] font-mono text-muted hover:text-negative transition-colors border border-border rounded px-1.5 py-0.5"
                  >
                    clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0} max={100} step={0.5}
                    placeholder="e.g. 5"
                    value={maxTrackingError !== null ? (maxTrackingError * 100).toFixed(1) : ''}
                    onChange={e => {
                      const v = e.target.value
                      if (v === '') { onMaxTrackingError(null); return }
                      const pct = parseFloat(v)
                      if (!isNaN(pct) && pct > 0) onMaxTrackingError(pct / 100)
                    }}
                    className="w-full bg-[#07090f] border border-border rounded-panel px-3 py-2 text-xs text-[#c8d0e0] font-mono focus:outline-none focus:border-accent transition-colors hover:border-border-bright placeholder-[#5a6a85]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted pointer-events-none">
                    % / yr
                  </span>
                </div>
                {maxTrackingError !== null && (
                  <span className="text-[9px] font-mono text-warning shrink-0 border border-warning/30 bg-warning/5 rounded px-1.5 py-0.5">
                    TE ≤ {(maxTrackingError * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-[9px] font-mono text-muted mt-1.5 italic">
                Adds ‖R_b − Rx‖₂/√T ≤ ψ̄ to the problem. The strategy may outperform the benchmark but cannot drift too far from it.
              </p>
            </div>
          )}
        </div>


      {/* Target return — only in Single Portfolio mode */}
      {!isFrontier && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted font-mono uppercase tracking-widest">
              Minimum Return Constraint
            </span>
            {targetReturn !== null && (
              <button
                type="button"
                onClick={() => onTargetReturn(null)}
                className="text-[9px] font-mono text-muted hover:text-negative transition-colors border border-border rounded px-1.5 py-0.5"
              >
                clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min={-100} max={200} step={0.5}
                placeholder="No constraint"
                value={targetReturn !== null ? (targetReturn * 100 * 252).toFixed(1) : ''}
                onChange={e => {
                  const v = e.target.value
                  if (v === '' || v === '-') { onTargetReturn(null); return }
                  const pct = parseFloat(v)
                  if (!isNaN(pct)) onTargetReturn(pct / 100 / 252)
                }}
                className="w-full bg-[#07090f] border border-border rounded-panel px-3 py-2 text-xs text-[#c8d0e0] font-mono focus:outline-none focus:border-accent transition-colors hover:border-border-bright placeholder-[#5a6a85]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted pointer-events-none">
                % / yr
              </span>
            </div>
            {targetReturn !== null && (
              <span className="text-[10px] font-mono text-accent shrink-0">
                μᵀx ≥ {(targetReturn * 100 * 252).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[9px] font-mono text-muted mt-1.5 italic">
            {targetReturn !== null
              ? `Forces the portfolio to achieve at least ${(targetReturn * 100 * 252).toFixed(1)}% annualized expected return.`
              : 'Leave empty to minimize risk with no return floor (pure risk minimization).'}
          </p>
        </div>
      )}

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

      {/* BL views panel — only shown when a BL mu method is active */}
      {isBL && (
        <div className="border-t border-border pt-4">
          <BLViewsPanel
            assets={assets.map(a => a.ticker)}
            views={blViews}
            onChange={onBlViewsChange}
          />
        </div>
      )}

      {/* Constraints panel */}
      <ConstraintsPanel
        assets={assets}
        longOnly={longOnly}
        onChange={onConstraintsChange}
        onGroupsChange={onGroupsChange}
        onLongOnly={onLongOnly}
      />

      {/* Action buttons */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onOptimize}
          disabled={!canRun || optimizeLoading}
          className="flex-1 py-2.5 rounded-panel disabled:opacity-35 disabled:cursor-not-allowed text-white text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            border: '1px solid rgba(59,130,246,0.25)',
            boxShadow: '0 0 20px rgba(37,99,235,0.21), 0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {optimizeLoading ? (
            <><Spinner /> Optimising…</>
          ) : 'Optimize Portfolio'}
        </button>
        <button
          onClick={onBacktest}
          disabled={!canRun || backtestLoading}
          className="flex-1 py-2.5 rounded-panel disabled:opacity-35 disabled:cursor-not-allowed text-muted-bright text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:border-accent hover:text-[#e8eaf0]"
          style={{ background: 'transparent', border: '1px solid #253050' }}
        >
          {backtestLoading ? (
            <><Spinner /> Backtesting…</>
          ) : 'Run Backtest'}
        </button>
      </div>
    </section>
  )
}
