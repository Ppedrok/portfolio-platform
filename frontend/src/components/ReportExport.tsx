/**
 * ReportExport.tsx
 * ----------------
 * Generates a print-ready HTML report and opens it in a new window.
 * The browser's print dialog → "Save as PDF" produces a professional PDF.
 *
 * Handles both:
 *  - Single optimisation result (OptimizeResponse)
 *  - Backtest result (BacktestResponse)
 */

import type { OptimizeResponse, BacktestResponse, TickerMatch } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, pct: boolean): string {
  if (v == null) return '—'
  return pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(3)
}

function colorStyle(v: number | null | undefined, invert = false): string {
  if (v == null) return 'color:#c8d0e0'
  const pos = invert ? v < 0 : v > 0
  return pos ? 'color:#00c77a' : 'color:#f43f5e'
}

// ── HTML template ─────────────────────────────────────────────────────────────

function generateHTML(opts: {
  type:        'optimization' | 'backtest'
  tickers:     string[]
  assets:      TickerMatch[]
  startDate:   string
  endDate:     string
  optMethod:   string
  muMethod:    string
  covMethod:   string
  optimizeData?: OptimizeResponse
  backtestData?: BacktestResponse
}): string {
  const { type, tickers, assets, startDate, endDate, optMethod, muMethod, covMethod, optimizeData, backtestData } = opts
  const now = new Date().toLocaleString()

  // ── Weights table ──────────────────────────────────────────────────────────
  let weightsRows = ''
  let weightsTitle = ''

  if (type === 'optimization' && optimizeData) {
    weightsTitle = 'Optimal Portfolio Weights'
    const sorted = Object.entries(optimizeData.weights).sort(([, a], [, b]) => b - a)
    for (const [ticker, w] of sorted) {
      const meta = assets.find(a => a.ticker === ticker)
      weightsRows += `
        <tr>
          <td><strong>${ticker}</strong></td>
          <td>${meta?.name || '—'}</td>
          <td>${meta?.sector || '—'}</td>
          <td style="text-align:right;font-weight:700">${(w * 100).toFixed(2)}%</td>
        </tr>`
    }
  } else if (type === 'backtest' && backtestData) {
    weightsTitle = 'Final Rebalancing Weights'
    const last = backtestData.weights_history[backtestData.weights_history.length - 1]
    if (last) {
      const sorted = Object.entries(last.weights).sort(([, a], [, b]) => b - a)
      for (const [ticker, w] of sorted) {
        const meta = assets.find(a => a.ticker === ticker)
        weightsRows += `
          <tr>
            <td><strong>${ticker}</strong></td>
            <td>${meta?.name || '—'}</td>
            <td>${meta?.sector || '—'}</td>
            <td style="text-align:right;font-weight:700">${(w * 100).toFixed(2)}%</td>
          </tr>`
      }
    }
  }

  // ── Metrics table ──────────────────────────────────────────────────────────
  const METRIC_ROWS_OPT = [
    { label: 'Annualized Return',     key: 'annualized_return',     pct: true,  inv: false },
    { label: 'Annualized Volatility', key: 'annualized_volatility', pct: true,  inv: false },
    { label: 'Sharpe Ratio',          key: 'sharpe_ratio',          pct: false, inv: false },
    { label: 'Sortino Ratio',         key: 'sortino_ratio',         pct: false, inv: false },
    { label: 'Max Drawdown',          key: 'max_drawdown',          pct: true,  inv: true  },
    { label: 'Calmar Ratio',          key: 'calmar_ratio',          pct: false, inv: false },
    { label: 'VaR 95%',               key: 'var_95',                pct: true,  inv: true  },
    { label: 'CVaR 95%',              key: 'cvar_95',               pct: true,  inv: true  },
    { label: 'Win Rate',              key: 'win_rate',              pct: true,  inv: false },
  ]

  const METRIC_KEYS_BT = [
    { label: 'Annualized Return',     key: 'Annualized Return',     pct: true,  inv: false },
    { label: 'Annualized Volatility', key: 'Annualized Volatility', pct: true,  inv: false },
    { label: 'Sharpe Ratio',          key: 'Sharpe Ratio',          pct: false, inv: false },
    { label: 'Sortino Ratio',         key: 'Sortino Ratio',         pct: false, inv: false },
    { label: 'Max Drawdown',          key: 'Max Drawdown',          pct: true,  inv: true  },
    { label: 'Calmar Ratio',          key: 'Calmar Ratio',          pct: false, inv: false },
    { label: 'VaR 95%',               key: 'VaR 95% (Historical)',  pct: true,  inv: true  },
    { label: 'CVaR 95%',              key: 'CVaR 95% (Historical)', pct: true,  inv: true  },
    { label: 'Win Rate',              key: 'Win Rate',              pct: true,  inv: false },
  ]

  let metricsRows = ''

  if (type === 'optimization' && optimizeData) {
    for (const row of METRIC_ROWS_OPT) {
      const v = optimizeData.metrics[row.key as keyof typeof optimizeData.metrics] as number | null
      metricsRows += `
        <tr>
          <td>${row.label}</td>
          <td style="text-align:right;${colorStyle(v, row.inv)};font-weight:600">${fmt(v, row.pct)}</td>
        </tr>`
    }
  } else if (type === 'backtest' && backtestData) {
    for (const row of METRIC_KEYS_BT) {
      const port = backtestData.metrics[row.key]?.['Portfolio'] ?? null
      const bm   = backtestData.metrics[row.key]?.['Benchmark'] ?? null
      metricsRows += `
        <tr>
          <td>${row.label}</td>
          <td style="text-align:right;${colorStyle(port, row.inv)};font-weight:600">${fmt(port, row.pct)}</td>
          <td style="text-align:right;${colorStyle(bm, row.inv)};font-weight:600">${fmt(bm, row.pct)}</td>
        </tr>`
    }
  }

  // ── Header details ─────────────────────────────────────────────────────────
  const isBacktest = type === 'backtest' && backtestData
  const headerDetail = isBacktest
    ? `<p><strong>OOS Period:</strong> ${backtestData!.oos_start} → ${backtestData!.oos_end} · ${backtestData!.rebalancing_steps} rebalancings</p>`
    : ''

  const metricHeader = type === 'backtest'
    ? '<th style="text-align:right">Portfolio</th><th style="text-align:right">Benchmark EW</th>'
    : '<th style="text-align:right">Value</th>'

  // ── Final HTML ─────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PortfolioOS — ${type === 'backtest' ? 'Backtest' : 'Optimization'} Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      color: #1a202c;
      background: #fff;
      padding: 40px 50px;
      max-width: 900px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 18px;
      border-bottom: 2px solid #2563eb;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #2563eb;
      letter-spacing: -0.5px;
    }
    .header .subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
      font-family: 'JetBrains Mono', monospace;
    }
    .header .meta {
      text-align: right;
      font-size: 11px;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
      line-height: 1.6;
    }

    /* Sections */
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #2563eb;
      margin-bottom: 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }

    /* Config grid */
    .config-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .config-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .config-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .config-value {
      font-size: 13px;
      font-weight: 600;
      color: #1a202c;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Universe chips */
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th {
      background: #f1f5f9;
      padding: 8px 12px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    td {
      padding: 7px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      font-family: 'JetBrains Mono', monospace;
    }
    tr:hover td { background: #f8fafc; }

    /* Hero metrics */
    .hero-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 18px;
    }
    .hero-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      background: #f8fafc;
    }
    .hero-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .hero-value {
      font-size: 24px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -1px;
    }
    .hero-sub {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: #64748b;
      margin-top: 3px;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      body { padding: 20px 30px; }
      .no-print { display: none !important; }
      a { text-decoration: none; color: inherit; }
    }
  </style>
</head>
<body>

  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="margin-bottom:20px;display:flex;gap:10px">
    <button onclick="window.print()" style="
      background:#2563eb;color:#fff;border:none;border-radius:6px;
      padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif
    ">🖨 Save as PDF</button>
    <button onclick="window.close()" style="
      background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:6px;
      padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif
    ">Close</button>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <h1>PortfolioOS</h1>
      <div class="subtitle">${type === 'backtest' ? 'Walk-Forward Backtest Report' : 'Portfolio Optimisation Report'}</div>
    </div>
    <div class="meta">
      Generated: ${now}<br/>
      Period: ${startDate} → ${endDate}<br/>
      ${isBacktest ? `OOS: ${backtestData!.oos_start} → ${backtestData!.oos_end}` : ''}
    </div>
  </div>

  <!-- Configuration -->
  <div class="section">
    <div class="section-title">Configuration</div>
    <div class="config-grid">
      <div class="config-item">
        <div class="config-label">Optimisation Method</div>
        <div class="config-value">${optMethod}</div>
      </div>
      <div class="config-item">
        <div class="config-label">Return Estimation (μ)</div>
        <div class="config-value">${muMethod}</div>
      </div>
      <div class="config-item">
        <div class="config-label">Covariance (Σ)</div>
        <div class="config-value">${covMethod}</div>
      </div>
    </div>
  </div>

  <!-- Universe -->
  <div class="section">
    <div class="section-title">Investment Universe (${tickers.length} assets)</div>
    <div class="chips">
      ${tickers.map(t => {
        const meta = assets.find(a => a.ticker === t)
        return `<span class="chip" title="${meta?.name || ''}">${t}</span>`
      }).join('')}
    </div>
    ${assets.some(a => a.sector) ? `
    <table style="margin-top:12px">
      <thead><tr><th>Ticker</th><th>Name</th><th>Sector</th></tr></thead>
      <tbody>
        ${assets.map(a => `
          <tr>
            <td><strong>${a.ticker}</strong></td>
            <td>${a.name || '—'}</td>
            <td>${a.sector || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : ''}
  </div>

  <!-- Performance Metrics -->
  <div class="section">
    <div class="section-title">Performance Metrics${isBacktest ? ' — Out-of-Sample' : ''}</div>

    <!-- Hero stats -->
    ${(() => {
      if (type === 'optimization' && optimizeData) {
        const ret = optimizeData.metrics.annualized_return
        const sr  = optimizeData.metrics.sharpe_ratio
        return `
        <div class="hero-grid">
          <div class="hero-card">
            <div class="hero-label">Annualized Return</div>
            <div class="hero-value" style="${colorStyle(ret)}">${fmt(ret, true)}</div>
          </div>
          <div class="hero-card">
            <div class="hero-label">Sharpe Ratio</div>
            <div class="hero-value" style="${colorStyle(sr)}">${fmt(sr, false)}</div>
          </div>
        </div>`
      }
      if (isBacktest) {
        const ret = backtestData!.metrics['Annualized Return']?.['Portfolio'] ?? null
        const sr  = backtestData!.metrics['Sharpe Ratio']?.['Portfolio'] ?? null
        const bmr = backtestData!.metrics['Annualized Return']?.['Benchmark'] ?? null
        const bms = backtestData!.metrics['Sharpe Ratio']?.['Benchmark'] ?? null
        return `
        <div class="hero-grid">
          <div class="hero-card" style="border-left:3px solid #2563eb">
            <div class="hero-label">Portfolio — Ann. Return</div>
            <div class="hero-value" style="${colorStyle(ret)}">${fmt(ret, true)}</div>
            <div class="hero-sub">Sharpe ${fmt(sr, false)}</div>
          </div>
          <div class="hero-card">
            <div class="hero-label">Benchmark EW — Ann. Return</div>
            <div class="hero-value" style="${colorStyle(bmr)}">${fmt(bmr, true)}</div>
            <div class="hero-sub">Sharpe ${fmt(bms, false)}</div>
          </div>
        </div>`
      }
      return ''
    })()}

    <table>
      <thead>
        <tr>
          <th>Metric</th>
          ${metricHeader}
        </tr>
      </thead>
      <tbody>${metricsRows}</tbody>
    </table>
  </div>

  <!-- Weights -->
  <div class="section">
    <div class="section-title">${weightsTitle}</div>
    <table>
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Name</th>
          <th>Sector</th>
          <th style="text-align:right">Weight</th>
        </tr>
      </thead>
      <tbody>${weightsRows}</tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>PortfolioOS · Institutional Grade Portfolio Analysis</span>
    <span>React · FastAPI · CVXPY · Riskfolio-Lib</span>
  </div>

  <script>
    // Auto-print when loaded (user can cancel)
    // window.onload = () => setTimeout(() => window.print(), 300)
  </script>
</body>
</html>`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  type:          'optimization' | 'backtest'
  assets:        TickerMatch[]
  startDate:     string
  endDate:       string
  optMethod:     string
  muMethod:      string
  covMethod:     string
  optimizeData?: OptimizeResponse
  backtestData?: BacktestResponse
}

export function ReportExportButton({
  type, assets, startDate, endDate,
  optMethod, muMethod, covMethod,
  optimizeData, backtestData,
}: Props) {
  const tickers = assets.map(a => a.ticker)

  function handleExport() {
    const html = generateHTML({
      type, tickers, assets, startDate, endDate,
      optMethod, muMethod, covMethod,
      optimizeData, backtestData,
    })
    const win = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes')
    if (!win) {
      alert('Pop-up blocked — please allow pop-ups for this site and try again.')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  const hasData = type === 'optimization' ? !!optimizeData : !!backtestData
  if (!hasData) return null

  return (
    <button
      onClick={handleExport}
      title="Export as PDF"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold
                 text-muted hover:text-[#c8d0e0] border border-border hover:border-accent/40
                 bg-transparent hover:bg-accent/5 transition-all"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <polyline points="9,15 12,18 15,15"/>
      </svg>
      Export PDF
    </button>
  )
}
