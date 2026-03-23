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

export type CodependenceMethod =
  | 'pearson' | 'spearman' | 'kendall' | 'gerber2'
  | 'distance' | 'mutual_info' | 'tail'

// ── Asset search ──────────────────────────────────────────────────────────────

export interface TickerMatch {
  ticker:     string
  name:       string
  exchange:   string
  asset_type: string
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
  tickers:        string[]
  start:          string
  end:            string
  mu_method:      MuMethod
  cov_method:     CovMethod
  opt_method:     OptMethod
  target_return:  number | 'frontier' | null
  constraints:    WeightConstraints
  rp_constraints: ConstraintRow[] | null
  asset_groups:   AssetGroup[] | null
  bl_views:       BLView[] | null
  long_only:      boolean
  solver:         string
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

// ── Backtest ──────────────────────────────────────────────────────────────────

export interface BacktestRequest {
  tickers:            string[]
  start:              string
  end:                string
  mu_method:          MuMethod
  cov_method:         CovMethod
  opt_method:         OptMethod
  estimation_window:  number
  rebalancing_freq:   number
  solver:             string
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
}
