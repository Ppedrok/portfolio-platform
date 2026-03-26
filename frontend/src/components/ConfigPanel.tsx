import type { ReactNode } from 'react'
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

const OPT_METHOD_GROUPS: { group: string; methods: { value: OptMethod; label: string }[] }[] = [
  {
    group: 'Variance-Based',
    methods: [
      { value: 'markowitz',           label: 'Mean-Variance (Markowitz)' },
    ],
  },
  {
    group: 'CVaR Family',
    methods: [
      { value: 'CVaR',  label: 'CVaR — Conditional Value at Risk' },
      { value: 'EVaR',  label: 'EVaR — Entropic Value at Risk' },
    ],
  },
  {
    group: 'Deviation-Based',
    methods: [
      { value: 'MAD',  label: 'MAD — Mean Absolute Deviation' },
      { value: 'SMAD', label: 'SMAD — Semi Mean Absolute Deviation' },
      { value: 'GMD',  label: 'GMD — Gini Mean Difference (slow)' },
    ],
  },
  {
    group: 'Downside Risk',
    methods: [
      { value: 'SemiVariance',        label: 'Semi-Variance' },
      { value: 'LowerPartialMoments', label: 'Lower Partial Moments' },
    ],
  },
  {
    group: 'Drawdown-Based',
    methods: [
      { value: 'Ulcer',    label: 'Ulcer Index' },
      { value: 'Brownian', label: 'Brownian Motion Distance (slow)' },
    ],
  },
  {
    group: 'Index Tracking',
    methods: [
      { value: 'TrackingError_L2',  label: 'Index Tracking (L2)' },
      { value: 'TrackingError_L1',  label: 'Index Tracking (L1 robust)' },
      { value: 'TrackingError_Cov', label: 'Index Tracking (Covariance)' },
    ],
  },
]


// ── Shared sub-components ─────────────────────────────────────────────────────

const SELECT_CLS =
  'w-full bg-[#0a0804] border border-border rounded-panel px-3 py-2.5 text-xs text-[#f0e8d4] ' +
  'focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer hover:border-border-bright'

function LabeledSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label:    string
  value:    T
  options:  { value: T; label: string; group?: string }[]
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

function GroupedMethodSelect({
  label,
  value,
  groups,
  onChange,
  badge,
}: {
  label:    string
  value:    OptMethod
  groups:   typeof OPT_METHOD_GROUPS
  onChange: (v: OptMethod) => void
  badge?:   ReactNode
}) {
  const currentLabel = groups.flatMap(g => g.methods).find(m => m.value === value)?.label ?? value
  const currentGroup = groups.find(g => g.methods.some(m => m.value === value))?.group ?? ''
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-[10px] text-muted font-mono uppercase tracking-widest">
          {label}
        </label>
        {badge}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value as OptMethod)}
        className={SELECT_CLS}
        style={{ colorScheme: 'dark' }}
      >
        {groups.map(g => (
          <optgroup key={g.group} label={`── ${g.group}`}>
            {g.methods.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="text-[9px] font-mono text-muted mt-1 italic">
        <span className="text-accent/60">{currentGroup}</span>
        <span className="mx-1 text-muted/40">·</span>
        <span>{currentLabel}</span>
      </p>
    </div>
  )
}

function SectionHeader({ label, number }: { label: string; number?: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {number && (
        <span className="text-[9px] font-mono text-muted/50 tabular-nums">{number}</span>
      )}
      <span className="text-[10px] text-muted font-mono uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-border" />
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
        <h2 className="text-sm font-semibold text-[#f0e8d4] uppercase tracking-wider">Configuration</h2>
      </div>

      {/* ── Optimization method ──────────────────────────────────────────── */}
      <SectionHeader label="Optimization Objective" />
      <GroupedMethodSelect
        label="Risk Measure"
        value={optMethod}
        groups={OPT_METHOD_GROUPS}
        onChange={onOptMethod}
        badge={
          isTracking ? (
            <span className="text-[9px] font-mono text-warning/70 border border-warning/30 bg-warning/5 rounded px-1.5 py-0.5">
              Tracking Mode
            </span>
          ) : undefined
        }
      />

      {/* ── Estimation parameters (collapsible hint) ─────────────────────── */}
      <SectionHeader label="Parameter Estimation" />
      <p className="text-[9px] font-mono text-muted/60 italic -mt-2">
        {optMethod === 'markowitz'
          ? 'Both μ and Σ are used by Mean-Variance optimization.'
          : optMethod === 'TrackingError_Cov'
          ? 'Σ is used by the Covariance tracking error formulation.'
          : 'These estimators affect Markowitz and TE-Cov only. For all other methods only the raw return matrix is used.'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <LabeledSelect label="Expected Returns (μ)" value={muMethod}  options={MU_METHODS}  onChange={onMuMethod}  />
        <LabeledSelect label="Covariance Matrix (Σ)" value={covMethod} options={COV_METHODS} onChange={onCovMethod} />
      </div>

      {/* ── Optimization mode ────────────────────────────────────────────── */}
      <SectionHeader label="Optimization Mode" />
      <div>
        <span className="block text-[10px] text-muted mb-2 font-mono uppercase tracking-widest sr-only">
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
                    : 'text-muted hover:text-[#f5f0e8]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Benchmark & Tracking Error ───────────────────────────────────── */}
      <SectionHeader label="Benchmark & Tracking Error" />
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
            className="w-full bg-[#0a0804] border border-border rounded-panel px-3 py-2.5 text-xs text-[#f0e8d4] font-mono focus:outline-none focus:border-accent transition-colors hover:border-border-bright placeholder-[#7a6848]"
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
                    className="w-full bg-[#0a0804] border border-border rounded-panel px-3 py-2 text-xs text-[#f0e8d4] font-mono focus:outline-none focus:border-accent transition-colors hover:border-border-bright placeholder-[#7a6848]"
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


      {/* ── Return constraint (single portfolio mode only) ───────────────── */}
      {!isFrontier && (
        <SectionHeader label="Return Constraint (optional)" />
      )}
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
                className="w-full bg-[#0a0804] border border-border rounded-panel px-3 py-2 text-xs text-[#f0e8d4] font-mono focus:outline-none focus:border-accent transition-colors hover:border-border-bright placeholder-[#7a6848]"
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

      {/* ── Weight constraints ───────────────────────────────────────────── */}
      <SectionHeader label="Weight Constraints" />
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

      {/* ── Backtest settings ────────────────────────────────────────────── */}
      <SectionHeader label="Backtest Settings" />
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

      {/* ── Black-Litterman views ────────────────────────────────────────── */}
      {isBL && (
        <>
          <SectionHeader label="Black-Litterman Views" />
          <BLViewsPanel
            assets={assets.map(a => a.ticker)}
            views={blViews}
            onChange={onBlViewsChange}
          />
        </>
      )}

      {/* ── Asset constraints ────────────────────────────────────────────── */}
      <SectionHeader label="Asset Constraints & Groups" />
      <ConstraintsPanel
        assets={assets}
        longOnly={longOnly}
        onChange={onConstraintsChange}
        onGroupsChange={onGroupsChange}
        onLongOnly={onLongOnly}
      />

      {/* ── Run ─────────────────────────────────────────────────────────── */}
      <SectionHeader label="Run" />
      <div className="flex gap-3 pt-1">
        <button
          onClick={onOptimize}
          disabled={!canRun || optimizeLoading}
          className="flex-1 py-2.5 rounded-panel disabled:opacity-35 disabled:cursor-not-allowed text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: '1px solid rgba(245,158,11,0.4)',
            boxShadow: '0 0 22px rgba(245,158,11,0.28), 0 2px 8px rgba(0,0,0,0.5)',
            color: '#070504',
          }}
        >
          {optimizeLoading ? (
            <><Spinner /> Optimising…</>
          ) : 'Optimize Portfolio'}
        </button>
        <button
          onClick={onBacktest}
          disabled={!canRun || backtestLoading}
          className="flex-1 py-2.5 rounded-panel disabled:opacity-35 disabled:cursor-not-allowed text-muted-bright text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:border-accent hover:text-[#f5f0e8]"
          style={{ background: 'transparent', border: '1px solid #3d2e10' }}
        >
          {backtestLoading ? (
            <><Spinner /> Backtesting…</>
          ) : 'Run Backtest'}
        </button>
      </div>
    </section>
  )
}
