/**
 * Documentation.tsx
 * -----------------
 * Comprehensive feature guide for PortfolioOS.
 * Accordion-style sections, Bloomberg terminal aesthetic.
 */

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocSection {
  id:       string
  title:    string
  badge?:   string
  content:  DocBlock[]
}

type DocBlock =
  | { type: 'p';     text: string }
  | { type: 'list';  items: { term: string; desc: string }[] }
  | { type: 'tip';   text: string }
  | { type: 'warn';  text: string }
  | { type: 'code';  text: string }

// ── Content ───────────────────────────────────────────────────────────────────

const SECTIONS: DocSection[] = [
  {
    id: 'quickstart',
    title: 'Quick Start',
    badge: 'START HERE',
    content: [
      { type: 'p', text: 'PortfolioOS is an institutional-grade portfolio optimization platform. Follow these four steps to build and analyse your first optimal portfolio:' },
      { type: 'list', items: [
        { term: '1. Select Assets',   desc: 'Search for tickers (stocks, ETFs, indices) in the Universe panel. Add at least 2 instruments and set your date range.' },
        { term: '2. Configure Model', desc: 'In the Configure panel, choose your expected return estimator (μ), covariance model (Σ), and optimization objective (e.g. CVaR, Markowitz).' },
        { term: '3. Run Optimization',desc: 'Click Optimize to find the minimum-risk portfolio, or enable Efficient Frontier to trace the full risk-return tradeoff curve.' },
        { term: '4. Analyse Results', desc: 'Explore the Optimization tab (weights, risk decomposition), run a Backtest, check Factor Analysis, or compare multiple frontiers side by side.' },
      ]},
      { type: 'tip', text: 'For a clean first run: use 4–8 liquid large-cap stocks, a 3–5 year date range, historical μ, Ledoit-Wolf Σ, and CVaR as the objective.' },
    ],
  },
  {
    id: 'universe',
    title: 'Asset Universe & Date Range',
    badge: 'SECTION 01',
    content: [
      { type: 'p', text: 'The Universe panel is where you define the investment opportunity set. All subsequent computations — parameter estimation, optimization, backtest — operate on exactly these assets over this date range.' },
      { type: 'list', items: [
        { term: 'Ticker Search',   desc: 'Type any ticker symbol or company name. Results include equities, ETFs, and indices from major exchanges. Click + to add to your portfolio.' },
        { term: 'Removing Assets', desc: 'Click the × badge on any chip in the header bar to remove an asset from the universe.' },
        { term: 'Start / End Date',desc: 'Daily price data is downloaded from Yahoo Finance. Longer windows give more observations (better covariance estimates) but older data may be less representative.' },
        { term: 'Minimum',         desc: 'At least 2 assets and 30 trading days are required. For reliable covariance estimation, aim for T ≥ 5×N (observations ≥ 5× number of assets).' },
      ]},
      { type: 'warn', text: 'Data for some tickers (especially international stocks, small-caps, or delisted names) may be incomplete or unavailable. The platform will return an error if fewer than 30 valid daily observations are found.' },
    ],
  },
  {
    id: 'overview',
    title: 'Asset Overview',
    badge: 'SECTION 01',
    content: [
      { type: 'p', text: 'Once 2+ assets are loaded, the Asset Overview panel automatically displays a pairwise (co)dependence matrix and individual return statistics.' },
      { type: 'list', items: [
        { term: 'Pearson',      desc: 'Standard linear correlation. Values near ±1 indicate strong linear relationships. Assumes normality; sensitive to outliers.' },
        { term: 'Spearman',     desc: 'Rank-based correlation. More robust to non-linearity and outliers than Pearson. Recommended for heavy-tailed assets.' },
        { term: 'Kendall',      desc: 'Concordance-based correlation. Counts pairs that rank in the same (or opposite) direction. Very robust, slightly slower.' },
        { term: 'Gerber2',      desc: 'A robust "co-movement" statistic that counts only days where both assets move significantly. Ignores noise. Particularly stable for non-normal data.' },
        { term: 'Mutual Info',  desc: 'Non-linear dependence captured via information theory. Detects any statistical relationship, not just monotone ones.' },
        { term: 'Tail',         desc: 'Measures co-movement in the tails (extreme events). High tail dependence means assets crash together, important for CVaR portfolios.' },
      ]},
    ],
  },
  {
    id: 'opt_objectives',
    title: 'Optimization Objectives',
    badge: 'SECTION 02',
    content: [
      { type: 'p', text: 'The optimization objective determines which risk measure is minimized, subject to a target return constraint (or, in frontier mode, swept across all feasible return levels). Each objective captures a different aspect of portfolio risk.' },
      { type: 'list', items: [
        { term: 'Markowitz (MVO)', desc: 'Minimizes portfolio variance w\'Σw. The classic mean-variance framework. Produces smooth, analytically tractable frontiers. Best when returns are approximately normally distributed.' },
        { term: 'CVaR',            desc: 'Conditional Value at Risk — minimizes the expected loss in the worst 5% of scenarios. Captures tail risk beyond VaR. Solved as a linear program; widely used in risk management.' },
        { term: 'MAD',             desc: 'Mean Absolute Deviation — minimizes the average absolute distance of returns from their mean. More robust than variance to outliers; solved as a linear program.' },
        { term: 'SMAD',            desc: 'Semi-MAD — like MAD but counts only downside deviations. Penalises negative surprises without penalising positive ones. Suitable for skewed return distributions.' },
        { term: 'Semi-Variance',   desc: 'Minimises the average squared downside deviation below the mean. Like variance, but one-sided. Preferred by investors who only care about downside risk.' },
        { term: 'LPM',             desc: 'Lower Partial Moments — penalises returns below a fixed threshold (default: 3% per year annualised). Directly models the cost of falling below a minimum acceptable return.' },
        { term: 'EVaR',            desc: 'Entropic Value at Risk — an upper bound on CVaR derived from the exponential utility function. More conservative than CVaR; captures extreme tails more severely.' },
        { term: 'Ulcer Index',     desc: 'Measures the depth and duration of drawdowns. High Ulcer Index means the portfolio takes long, deep dips below its peak. Ideal for wealth-preservation mandates.' },
        { term: 'GMD',             desc: 'Gini Mean Difference — mean absolute difference between all pairs of portfolio returns. A non-parametric dispersion measure; very robust but computationally intensive (O(T²)).' },
        { term: 'Brownian',        desc: 'Uses a Brownian distance-based risk measure that captures non-linear dependencies between assets. Computationally heavy; capped at 63 observations on free-tier servers.' },
      ]},
      { type: 'tip', text: 'For tail-risk-sensitive portfolios (e.g. concentrated tech positions), prefer CVaR or EVaR over Markowitz. For drawdown-sensitive mandates (pension funds, endowments), use Ulcer Index.' },
      { type: 'warn', text: 'GMD and Brownian Motion require O(T²) auxiliary variables. On the free-tier server they are capped at the last 63 trading days (~3 months) to avoid memory limits.' },
    ],
  },
  {
    id: 'mu_methods',
    title: 'Expected Return Estimation (μ)',
    badge: 'SECTION 02',
    content: [
      { type: 'p', text: 'Expected returns (μ) are the most uncertain input in portfolio optimization — small errors compound dramatically in the optimal weights. The platform offers several estimators ranging from naive historical means to sophisticated Bayesian and factor-model approaches.' },
      { type: 'list', items: [
        { term: 'Historical',       desc: 'Simple annualised sample mean of daily returns. Unbiased but very noisy — estimation error often exceeds the true signal. Suitable as a baseline.' },
        { term: 'James-Stein (JS)', desc: 'Shrinks individual asset means toward a common target (JS_1: global mean, JS_2: min-variance portfolio return, JS_3: zero). Reduces estimation error by pooling information. JS_2 is generally the most stable.' },
        { term: 'Bayes-Stein (BS)', desc: 'Bayesian update: combines a prior (BS_1: grand mean, BS_2: min-variance, BS_3: risk-free) with the sample mean. Produces smoother, more stable out-of-sample estimates.' },
        { term: 'BOP (1/2/3)',      desc: 'Bodnar-Okhrin-Parolya shrinkage — a theoretically optimal linear combination of prior and sample mean under quadratic loss. More principled than ad hoc shrinkage.' },
        { term: 'Black-Litterman',  desc: 'Reverse-engineers CAPM equilibrium returns (implied by equal-weight prior) and blends them with investor views (P/Q matrices). Produces intuitive, well-calibrated μ vectors. Add views in the BL Views panel.' },
        { term: 'Fama-French 3',    desc: 'Estimates μ from a 3-factor OLS regression: Market (Mkt-RF), Size (SMB), Value (HML). Factor betas × current factor risk premia give the implied expected return for each asset.' },
        { term: 'Fama-French 5',    desc: 'Adds Profitability (RMW) and Investment (CMA) to FF3. More accurate for assets with strong quality/investment tilts.' },
        { term: 'Carhart 4',        desc: 'Adds Momentum (MOM) to FF3. Captures short-term return continuation. Particularly relevant for trend-following or momentum strategies.' },
      ]},
      { type: 'tip', text: 'In practice, Bayes-Stein and James-Stein shrinkage estimators consistently outperform historical means in out-of-sample tests. Black-Litterman is best when you have informed views on specific assets.' },
    ],
  },
  {
    id: 'cov_methods',
    title: 'Covariance Estimation (Σ)',
    badge: 'SECTION 02',
    content: [
      { type: 'p', text: 'The covariance matrix drives both risk estimation and the shape of the efficient frontier. The sample covariance is unbiased but noisy, especially when T (observations) is close to N (assets). Well-conditioned estimators reduce noise and improve out-of-sample performance.' },
      { type: 'list', items: [
        { term: 'Historical',        desc: 'Plain sample covariance matrix. Invertible only when T > N. Suffers from noise amplification; eigenvalues of the sample matrix overstate the spread of the true eigenvalues.' },
        { term: 'Ledoit-Wolf',       desc: 'Analytical shrinkage toward a structured target (constant correlation model). Closed-form optimal shrinkage intensity. The most popular and reliable all-purpose estimator.' },
        { term: 'OAS',               desc: 'Oracle Approximating Shrinkage — minimises the Frobenius norm to the true covariance. Better conditioned than Ledoit-Wolf when T/N is small.' },
        { term: 'Shrunk',            desc: 'General Ledoit-Wolf shrinkage with cross-validated intensity. Flexible but slightly slower than the analytical version.' },
        { term: 'Denoised (RMT)',    desc: 'Removes eigenvalues below the Marchenko-Pastur bulk (noise floor from Random Matrix Theory). Retains only statistically significant eigenmodes. Good for large, diversified portfolios.' },
        { term: 'Spectral',          desc: 'Full eigenvalue cleaning using the Marchenko-Pastur distribution. All bulk eigenvalues are replaced with their average, preserving only the signal subspace.' },
        { term: 'Graph Lasso',       desc: 'Estimates a sparse precision matrix (inverse covariance) via L1 regularisation. Forces many partial correlations to zero, resulting in a network-like dependency structure.' },
        { term: 'JLOGO',             desc: 'J-LoGo estimator using partial correlation network filtering (maximum spanning tree). Preserves only the most important dependencies; very stable for large universes.' },
        { term: 'Fama-French (FM)',  desc: 'Factor model covariance: Σ = BΣ_fB\' + Σ_ε. Compresses the N×N matrix into k factor exposures + idiosyncratic variances. Dramatically reduces estimation error for large N.' },
      ]},
      { type: 'tip', text: 'Ledoit-Wolf is the best default for most use cases. For universes with N > 50 assets or T/N < 3, prefer Denoised (RMT) or Fama-French factor covariance.' },
    ],
  },
  {
    id: 'constraints',
    title: 'Portfolio Constraints',
    badge: 'SECTION 02',
    content: [
      { type: 'p', text: 'Constraints shape the feasible region of the optimisation problem. All constraints are enforced as hard bounds.' },
      { type: 'list', items: [
        { term: 'Long-Only',       desc: 'Forces all weights ≥ 0. When disabled, short selling is allowed (weights can go negative). Most institutional mandates require long-only.' },
        { term: 'Max Weight',      desc: 'Upper bound on any single asset weight (e.g. 0.40 = 40%). Prevents extreme concentration in one asset. Set to 1.0 to allow unconstrained concentration.' },
        { term: 'Min Weight',      desc: 'Lower bound on any active asset weight. Use 0.0 for long-only without a minimum. Set e.g. 0.02 to force a minimum 2% allocation to every included asset.' },
        { term: 'Asset Groups',    desc: 'Define named groups (e.g. "Tech", "Bonds") and assign tickers to each. Enables group-level constraints such as "Bonds ≥ 20%" or "Tech ≤ 40%".' },
        { term: 'RP Constraints',  desc: 'Advanced row constraints: limit individual assets, groups, or relative weights. Each row specifies a Set (ticker or group name), Sign (≥ or ≤), and a Weight bound.' },
      ]},
      { type: 'code', text: 'Example: Max Weight = 0.30 + Asset Group "Tech" (AAPL, MSFT, NVDA) with constraint Classes / Tech / ≤ 0.50 → no single asset exceeds 30%, Tech sector capped at 50%.' },
    ],
  },
  {
    id: 'frontier',
    title: 'Efficient Frontier',
    badge: 'SECTION 03',
    content: [
      { type: 'p', text: 'Enable "Efficient Frontier" in the Configure panel to trace the full risk-return tradeoff curve instead of a single optimal point. The frontier sweeps 40 target-return levels from the minimum-risk to the maximum-return portfolio.' },
      { type: 'list', items: [
        { term: 'Interpretation',    desc: 'Each point on the frontier is the portfolio that minimises the chosen risk measure for a given expected return. Points to the upper-left dominate: same return with less risk, or more return with same risk.' },
        { term: 'Min-Variance Point',desc: 'The leftmost point — the portfolio with the lowest achievable risk regardless of return. Used as a conservative benchmark.' },
        { term: 'Max-Sharpe Point',  desc: 'The portfolio with the highest Sharpe ratio (return per unit of risk). The tangency portfolio on the Capital Market Line.' },
        { term: 'Scatter Chart',     desc: 'X-axis = annualised volatility (σ). Y-axis = annualised expected return (μ). Dot size is fixed; hover to see weights at that point.' },
        { term: 'Area Stacks',       desc: 'Below the scatter, stacked areas show how asset weights evolve as you move from min-risk to max-return along the frontier.' },
      ]},
      { type: 'tip', text: 'Compare frontiers across different risk objectives in the "Compare Frontiers" tab. With near-normally distributed returns, most methods produce similar frontiers in (σ, μ) space — divergence becomes visible for methods like Ulcer Index (drawdown-sensitive) vs. Markowitz (variance-sensitive).' },
    ],
  },
  {
    id: 'backtest',
    title: 'Walk-Forward Backtest',
    badge: 'SECTION 04',
    content: [
      { type: 'p', text: 'The backtest simulates how the optimizer would have performed historically, using a walk-forward (expanding or rolling window) methodology to avoid look-ahead bias.' },
      { type: 'list', items: [
        { term: 'Methodology',         desc: 'The date range is split into in-sample (estimation) and out-of-sample (evaluation) windows. At each rebalancing step, the model re-estimates μ and Σ on all data up to that date, optimizes, then holds those weights until the next rebalancing.' },
        { term: 'Estimation Window',   desc: 'Number of trading days used to estimate μ and Σ at each rebalancing step. Default: 252 (1 year). Longer windows = more stable estimates but slower adaptation.' },
        { term: 'Rebalancing Freq',    desc: 'Number of trading days between rebalancing steps. Default: 21 (~monthly). Lower values = more frequent rebalancing = higher turnover and transaction costs (not modelled).' },
        { term: 'Equity Curve',        desc: 'Cumulative performance of the backtested portfolio starting from $1. Compared against an equal-weight benchmark.' },
        { term: 'Metrics',             desc: 'Annualised return, volatility, Sharpe, Sortino, Max Drawdown, Calmar Ratio, CVaR, Win Rate — computed on the full out-of-sample period.' },
        { term: 'Weights Heatmap',     desc: 'Shows how portfolio weights evolve at each rebalancing date. Dark cells = high weight. Useful to identify drift and turnover.' },
      ]},
      { type: 'warn', text: 'The backtest does not account for transaction costs, slippage, or market impact. Treat results as an upper bound on real-world performance.' },
    ],
  },
  {
    id: 'factors',
    title: 'Factor Analysis (Fama-French)',
    badge: 'SECTION 05',
    content: [
      { type: 'p', text: 'The Factor Exposure tab runs OLS regressions of each asset\'s excess returns on a set of risk factors. This decomposes asset performance into systematic (factor) and idiosyncratic (alpha) components.' },
      { type: 'list', items: [
        { term: 'FF3 (3-Factor)',  desc: 'Market factor (Mkt-RF), Size (SMB = Small Minus Big), Value (HML = High Minus Low book-to-market). The foundation of modern factor investing.' },
        { term: 'FF5 (5-Factor)',  desc: 'Adds Profitability (RMW = Robust Minus Weak operating profit) and Investment (CMA = Conservative Minus Aggressive asset growth). Explains a broader cross-section of returns.' },
        { term: 'Carhart 4',       desc: 'Adds Momentum (MOM = past 12-month return minus past 1-month). Captures trend persistence that FF3/FF5 miss.' },
        { term: 'Beta (β)',         desc: 'Sensitivity of the asset\'s return to each factor. β > 1 on Mkt-RF = amplified market exposure. Positive HML beta = value tilt. Positive MOM beta = momentum tilt.' },
        { term: 'Alpha (α)',        desc: 'Annualised intercept — return unexplained by the factors. Positive alpha suggests skill or omitted factors; negative alpha suggests return drag.' },
        { term: 'R² (R-squared)',   desc: 'Fraction of return variance explained by the model. R² = 0.95 means 95% of the asset\'s volatility is systematic (factor-driven). Low R² implies high idiosyncratic risk.' },
        { term: 'T-stat / P-value',desc: 'Statistical significance of each beta. |t| > 2 (p < 0.05) = statistically significant at 5% level (marked ✦). Insignificant betas may be noise.' },
      ]},
      { type: 'tip', text: 'Factor betas are also used to estimate μ and Σ when FF3_mu, FF5_mu, Carhart4_mu, FF3_cov, etc. are selected as estimation methods. This links the factor analysis directly to the optimizer inputs.' },
    ],
  },
  {
    id: 'compare',
    title: 'Compare Frontiers',
    badge: 'SECTION 05',
    content: [
      { type: 'p', text: 'The Compare Frontiers tab runs the efficient frontier for multiple optimization objectives simultaneously and overlays them on a single chart, allowing you to see how different risk definitions reshape the opportunity set.' },
      { type: 'list', items: [
        { term: 'Method Selection',    desc: 'Check any combination of optimization methods. All selected frontiers are computed in parallel — faster methods (CVaR, MAD) appear first while heavier ones (EVaR) are still running.' },
        { term: 'Frontier Chart',      desc: 'Each method is plotted as a distinct coloured curve with a unique dash pattern. When curves coincide (common for near-normal returns), dash patterns remain distinguishable.' },
        { term: 'Overlap Behaviour',   desc: 'For assets with approximately elliptical return distributions (e.g. liquid large-cap equities), most methods produce near-identical (σ, μ) frontiers. This is theoretically expected — the frontiers diverge in the original risk-measure space, not in volatility space.' },
        { term: 'Max-Sharpe Comparison', desc: 'Even when frontiers overlap, the Max-Sharpe portfolios selected by each method differ in their weight allocation. The bar chart and weight table reveal how CVaR concentrates differently from Ulcer Index, for instance.' },
        { term: 'Statistics Table',    desc: 'Summarises the frontier for each method: number of computed points, Min-Vol portfolio (return + volatility), Max-Sharpe portfolio (Sharpe + coordinates), and maximum achievable return.' },
      ]},
      { type: 'tip', text: 'To see clearly divergent frontiers, try assets with asymmetric or fat-tailed return distributions (crypto, small-caps, commodities), or include a stress period like 2008 or 2020 in your date range. Ulcer Index and Markowitz frontiers are most likely to visibly separate.' },
      { type: 'warn', text: 'Avoid GMD and Brownian Motion in the Compare tab on the free-tier server — both cap observations at 63 days and have 20 frontier points instead of 40 to stay within the compute budget.' },
    ],
  },
  {
    id: 'bl',
    title: 'Black-Litterman Views',
    badge: 'SECTION 02',
    content: [
      { type: 'p', text: 'When Black-Litterman (BL_standard) is selected as the μ method, a Views panel appears. BL blends a neutral prior (CAPM equilibrium returns implied by equal weights) with your subjective views.' },
      { type: 'list', items: [
        { term: 'No Views',       desc: 'If no views are entered, BL defaults to pure CAPM equilibrium returns (inverse-variance-weighted portfolio as proxy). All assets get the same Sharpe ratio.' },
        { term: 'Absolute View',  desc: 'State that a specific asset will return at least (≥) or at most (≤) a given annual return. Example: "AAPL ≥ 15%" means you believe Apple will return at least 15% per year.' },
        { term: 'View Blending',  desc: 'BL blends your view with the prior proportionally to your confidence. Without explicit confidence setting, moderate blending is used (τ = 0.05).' },
        { term: 'Interpretation', desc: 'BL is most valuable when you have specific, well-researched views on a few assets. It prevents the optimizer from acting aggressively on noisy sample means.' },
      ]},
      { type: 'code', text: 'Example: Add views "NVDA ≥ 25%" and "T ≤ 3%" to express bullishness on Nvidia and bearishness on AT&T. The BL μ will shift accordingly while remaining anchored to equilibrium.' },
    ],
  },
]

// ── Renderer ──────────────────────────────────────────────────────────────────

function renderBlock(block: DocBlock, i: number) {
  switch (block.type) {
    case 'p':
      return (
        <p key={i} style={{ color: '#8892a4', fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>
          {block.text}
        </p>
      )
    case 'list':
      return (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {block.items.map((item, j) => (
            <div key={j} style={{ display: 'flex', gap: 10 }}>
              <span style={{
                fontFamily:   '"JetBrains Mono", monospace',
                fontSize:     10,
                fontWeight:   700,
                color:        '#f97316',
                whiteSpace:   'nowrap',
                paddingTop:   1,
                minWidth:     160,
                flexShrink:   0,
              }}>
                {item.term}
              </span>
              <span style={{ color: '#8892a4', fontSize: 11.5, lineHeight: 1.65 }}>
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      )
    case 'tip':
      return (
        <div key={i} style={{
          background:   'rgba(16,185,129,0.06)',
          border:       '1px solid rgba(16,185,129,0.2)',
          borderRadius: 6,
          padding:      '8px 12px',
          marginBottom: 12,
          fontSize:     11,
          color:        '#10b981',
          fontFamily:   '"JetBrains Mono", monospace',
          lineHeight:   1.6,
        }}>
          <span style={{ fontWeight: 700, marginRight: 6 }}>TIP</span>
          {block.text}
        </div>
      )
    case 'warn':
      return (
        <div key={i} style={{
          background:   'rgba(245,158,11,0.06)',
          border:       '1px solid rgba(245,158,11,0.2)',
          borderRadius: 6,
          padding:      '8px 12px',
          marginBottom: 12,
          fontSize:     11,
          color:        '#f59e0b',
          fontFamily:   '"JetBrains Mono", monospace',
          lineHeight:   1.6,
        }}>
          <span style={{ fontWeight: 700, marginRight: 6 }}>⚠ NOTE</span>
          {block.text}
        </div>
      )
    case 'code':
      return (
        <div key={i} style={{
          background:   '#100d06',
          border:       '1px solid #2a1e08',
          borderRadius: 6,
          padding:      '8px 12px',
          marginBottom: 12,
          fontSize:     10.5,
          color:        '#f0e8d4',
          fontFamily:   '"JetBrains Mono", monospace',
          lineHeight:   1.6,
        }}>
          {block.text}
        </div>
      )
    default:
      return null
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function Documentation() {
  const [openId, setOpenId] = useState<string | null>('quickstart')

  return (
    <section
      id="docs"
      style={{
        background:   '#0a0e17',
        border:       '1px solid #2a1e08',
        borderRadius: 12,
        overflow:     'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        padding:      '16px 20px',
        borderBottom: '1px solid #2a1e08',
        background:   'linear-gradient(90deg, rgba(245,158,11,0.08) 0%, transparent 60%)',
      }}>
        <span style={{
          fontFamily:    '"JetBrains Mono", monospace',
          fontSize:      9,
          fontWeight:    700,
          color:         '#f97316',
          letterSpacing: '0.15em',
          border:        '1px solid rgba(79,142,247,0.3)',
          background:    'rgba(79,142,247,0.08)',
          padding:       '2px 7px',
          borderRadius:  4,
        }}>
          06
        </span>
        <h2 style={{
          fontFamily:    '"JetBrains Mono", monospace',
          fontSize:      12,
          fontWeight:    600,
          color:         '#f0e8d4',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin:        0,
        }}>
          Platform Documentation
        </h2>
        <span style={{
          marginLeft:    'auto',
          fontFamily:    '"JetBrains Mono", monospace',
          fontSize:      9,
          color:         '#3d2e10',
          letterSpacing: '0.1em',
        }}>
          {SECTIONS.length} SECTIONS
        </span>
      </div>

      {/* Accordion */}
      <div>
        {SECTIONS.map((sec, idx) => {
          const isOpen = openId === sec.id
          return (
            <div
              key={sec.id}
              style={{ borderBottom: idx < SECTIONS.length - 1 ? '1px solid #111827' : 'none' }}
            >
              {/* Section header / toggle */}
              <button
                onClick={() => setOpenId(isOpen ? null : sec.id)}
                style={{
                  width:       '100%',
                  display:     'flex',
                  alignItems:  'center',
                  gap:         12,
                  padding:     '13px 20px',
                  background:  isOpen ? 'rgba(245,158,11,0.06)' : 'transparent',
                  border:      'none',
                  cursor:      'pointer',
                  textAlign:   'left',
                  transition:  'background 0.15s',
                  borderLeft:  `2px solid ${isOpen ? '#f59e0b' : 'transparent'}`,
                }}
                onMouseEnter={e => {
                  if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                }}
                onMouseLeave={e => {
                  if (!isOpen) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {/* Badge */}
                {sec.badge && (
                  <span style={{
                    fontFamily:    '"JetBrains Mono", monospace',
                    fontSize:      8.5,
                    fontWeight:    700,
                    color:         isOpen ? '#f97316' : '#3d2e10',
                    letterSpacing: '0.12em',
                    whiteSpace:    'nowrap',
                    minWidth:      72,
                  }}>
                    {sec.badge}
                  </span>
                )}

                {/* Title */}
                <span style={{
                  fontFamily:    '"JetBrains Mono", monospace',
                  fontSize:      11.5,
                  fontWeight:    isOpen ? 600 : 400,
                  color:         isOpen ? '#f5f0e8' : '#8a7455',
                  letterSpacing: '0.04em',
                  flex:          1,
                }}>
                  {sec.title}
                </span>

                {/* Chevron */}
                <svg
                  width="12" height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke={isOpen ? '#f97316' : '#3d2e10'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  style={{
                    flexShrink: 0,
                    transform:  isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <path d="M2 4l4 4 4-4"/>
                </svg>
              </button>

              {/* Content */}
              {isOpen && (
                <div style={{
                  padding:    '4px 20px 20px 20px',
                  borderTop:  '1px solid #111827',
                  background: '#070b12',
                }}>
                  <div style={{ paddingTop: 14 }}>
                    {sec.content.map((block, i) => renderBlock(block, i))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
