// ── Method enumerations ───────────────────────────────────────────────────────

export type MuMethod =
  | 'historical'
  | 'JS_1' | 'JS_2' | 'JS_3'
  | 'BS_1' | 'BS_2' | 'BS_3'
  | 'BOP_1' | 'BOP_2' | 'BOP_3'
  | 'BL_standard'
  | 'FF3_mu' | 'FF5_mu' | 'Carhart4_mu'

export type CovMethod =
  | 'historical' | 'ledoit_wolf' | 'oas' | 'shrunk'
  | 'denoised_fixed' | 'spectral' | 'graph_lasso' | 'jlogo'
  | 'FF3_cov' | 'FF5_cov' | 'Carhart4_cov'

// ── Factor exposure ───────────────────────────────────────────────────────────

export type FactorModel = 'FF3' | 'FF5' | 'Carhart4'

export interface AssetFactorRow {
  ticker:   string
  alpha:    number        // annualised
  r2:       number
  betas:    Record<string, number>
  t_stats:  Record<string, number>
  p_values: Record<string, number>
}

export interface FactorExposureResponse {
  model:   FactorModel
  factors: string[]
  assets:  AssetFactorRow[]
}

export type OptMethod =
  | 'markowitz' | 'CVaR' | 'MAD' | 'SMAD' | 'SemiVariance'
  | 'LowerPartialMoments' | 'EVaR' | 'Ulcer' | 'GMD' | 'Brownian'
  | 'TrackingError_L2' | 'TrackingError_L1' | 'TrackingError_Cov'

export type CodependenceMethod =
  | 'pearson' | 'spearman' | 'kendall' | 'gerber2'
  | 'distance' | 'mutual_info' | 'tail'

// ── Asset search ──────────────────────────────────────────────────────────────

export interface TickerMatch {
  ticker:     string
  name:       string
  exchange:   string
  asset_type: string
  sector:     string
}

export interface SearchResponse {
  query:   string
  results: TickerMatch[]
}

// ── Asset overview ────────────────────────────────────────────────────────────

export interface OverviewRequest {
  tickers: string[]
  start:   string
  end:     string
  method:  CodependenceMethod
}

export interface OverviewResponse {
  tickers:            string[]
  method:             string
  codependence:       Record<string, Record<string, number>>
  distance:           Record<string, Record<string, number>>
  annualized_returns: Record<string, number | null>
  annualized_vols:    Record<string, number | null>
  sharpes:            Record<string, number | null>
  sortinos:           Record<string, number | null>
  calmars:            Record<string, number | null>
  max_drawdowns:      Record<string, number | null>
  vars_95:            Record<string, number | null>
  cvars_95:           Record<string, number | null>
  skews:              Record<string, number | null>
  kurts:              Record<string, number | null>
  win_rates:          Record<string, number | null>
  period_returns:     Record<string, Record<string, number | null>>
  dendrogram?: {
    icoord:  number[][]   // [x0,x1,x2,x3] for each U-shape
    dcoord:  number[][]   // [y0,y1,y2,y3] for each U-shape
    ivl:     string[]     // leaf labels left→right
    leaves:  number[]     // original leaf indices
  }
}

// ── Optimize ──────────────────────────────────────────────────────────────────

export interface AssetGroup {
  name:    string
  tickers: string[]
}

export interface WeightConstraints {
  max_weight: number
  min_weight: number
}

export interface ConstraintRow {
  disabled:      boolean
  type:          'Assets' | 'All Assets' | 'Classes' | 'Each asset in a class'
  set:           string
  position:      string
  sign:          '>=' | '<='
  weight:        number | ''
  type_relative: '' | 'Assets' | 'Classes'
  relative_set:  string
  relative:      string
  factor:        number | ''
}

export interface BLView {
  asset: string
  sign:  '>=' | '<='
  value: number   // annual %, e.g. 10 = 10%/yr
}

export interface OptimizeRequest {
  tickers:             string[]
  start:               string
  end:                 string
  mu_method:           MuMethod
  cov_method:          CovMethod
  opt_method:          OptMethod
  target_return:       number | 'frontier' | null
  constraints:         WeightConstraints
  rp_constraints:      ConstraintRow[] | null
  asset_groups:        AssetGroup[] | null
  bl_views:            BLView[] | null
  benchmark_ticker?:   string
  max_tracking_error?: number
  long_only:           boolean
  solver:              string
}

export interface PortfolioMetrics {
  annualized_return:     number | null
  annualized_volatility: number | null
  sharpe_ratio:          number | null
  sortino_ratio:         number | null
  max_drawdown:          number | null
  calmar_ratio:          number | null
  var_95:                number | null
  cvar_95:               number | null
  win_rate:              number | null
}

export interface RiskDecompositionData {
  assets:                       string[]
  weights:                      number[]
  marginal_risk_contribution:   number[]
  component_risk_contribution:  number[]
  percentage_risk_contribution: number[]
  individual_volatilities:      number[]
  portfolio_volatility:         number
  diversification_ratio:        number
  component_cvar:               number[]
  percentage_cvar_contribution: number[]
  portfolio_cvar:               number
}

export interface OptimizeResponse {
  tickers:            string[]
  weights:            Record<string, number>
  metrics:            PortfolioMetrics
  risk_decomposition: RiskDecompositionData | null
  warning:            string | null
  tracking_error:     number | null
}

export interface FrontierPoint {
  portfolio_id:        number
  weights:             Record<string, number>
  expected_return:     number | null
  expected_volatility: number | null
}

export interface FrontierResponse {
  tickers:    string[]
  portfolios: FrontierPoint[]
}

// ── Portfolio Snapshot (for multi-strategy comparison) ────────────────────────

export interface SnapshotConfig {
  // Date range
  trainStart:       string
  trainEnd:         string
  // Methods
  muMethod:         string
  covMethod:        string
  optMethod:        string
  // Walk-forward params
  estimationWindow: number
  rebalancingFreq:  number
  // Constraints
  longOnly:         boolean
  minWeight:        number
  maxWeight:        number
  benchmarkTicker:  string
  maxTrackingError: number | null
  // Solver
  solver:           string
}

export interface PortfolioSnapshot {
  id:           string
  label:        string
  savedAt:      string                          // ISO date
  optMethod:    string
  tickers:      string[]
  oos_start:    string
  oos_end:      string
  equity_curve: EquityCurvePoint[]
  metrics:      Record<string, Record<string, number | null>>
  finalWeights: Record<string, number>
  // ── Full run configuration ──
  config?:      SnapshotConfig
  // ── All rebalancing weights over time ──
  weightsHistory?: { date: string; weights: Record<string, number> }[]
}

// ── Backtest ──────────────────────────────────────────────────────────────────

export interface BacktestRequest {
  tickers:             string[]
  start:               string
  end:                 string
  mu_method:           MuMethod
  cov_method:          CovMethod
  opt_method:          OptMethod
  estimation_window:   number
  rebalancing_freq:    number
  solver:              string
  constraints:         WeightConstraints
  rp_constraints:      ConstraintRow[] | null
  asset_groups:        AssetGroup[] | null
  long_only:           boolean
  benchmark_ticker?:   string
  max_tracking_error?: number
}

export interface EquityCurvePoint {
  date:             string
  portfolio_value:  number
  benchmark_value:  number | null
}

export interface WeightsRecord {
  date:    string
  weights: Record<string, number>
}

export interface BacktestResponse {
  tickers:            string[]
  oos_start:          string
  oos_end:            string
  rebalancing_steps:  number
  equity_curve:       EquityCurvePoint[]
  weights_history:    WeightsRecord[]
  metrics:            Record<string, Record<string, number | null>>
  failed_steps:       number
  opt_warnings:       string[]
  benchmark_label:    string
}
