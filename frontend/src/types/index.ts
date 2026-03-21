// ── Method enumerations ───────────────────────────────────────────────────────

export type MuMethod =
  | 'historical'
  | 'JS_1' | 'JS_2' | 'JS_3'
  | 'BS_1' | 'BS_2' | 'BS_3'
  | 'BOP_1' | 'BOP_2' | 'BOP_3'
  | 'BL_standard'

export type CovMethod =
  | 'historical' | 'ledoit_wolf' | 'oas' | 'shrunk'
  | 'denoised_fixed' | 'spectral' | 'graph_lasso' | 'jlogo'

export type OptMethod =
  | 'markowitz' | 'CVaR' | 'MAD' | 'SMAD' | 'SemiVariance'
  | 'LowerPartialMoments' | 'EVaR' | 'Ulcer' | 'GMD'

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

// ── Optimize ──────────────────────────────────────────────────────────────────

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

export interface OptimizeResponse {
  tickers: string[]
  weights: Record<string, number>
  metrics: PortfolioMetrics
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
