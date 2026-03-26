import type { BacktestResponse } from '../types'

interface Props { data: BacktestResponse }

/** Teal → blue → indigo based on weight magnitude */
function weightToColor(w: number): string {
  if (w < 0.001) return '#100d06'
  const t = Math.min(1, w * 2.5)   // 40%+ → full colour
  if (t <= 0.5) {
    // teal (#f97316) → blue (#f59e0b)
    const s = t * 2
    const r = Math.round(14  + (37  - 14)  * s)
    const g = Math.round(165 + (99  - 165) * s)
    const b = Math.round(233 + (235 - 233) * s)
    return `rgb(${r},${g},${b})`
  } else {
    // blue (#f59e0b) → indigo (#6366f1)
    const s = (t - 0.5) * 2
    const r = Math.round(37  + (99  - 37)  * s)
    const g = Math.round(99  + (102 - 99)  * s)
    const b = Math.round(235 + (241 - 235) * s)
    return `rgb(${r},${g},${b})`
  }
}

const MAX_COLS = 40

export function WeightsHeatmap({ data }: Props) {
  const { tickers, weights_history } = data

  const step    = Math.max(1, Math.floor(weights_history.length / MAX_COLS))
  const history = weights_history.filter((_, i) => i % step === 0)

  return (
    <div className="bg-card card-top-accent rounded-panel p-4 border border-border overflow-x-auto">
      <p className="text-[10px] text-muted font-mono uppercase tracking-widest mb-1">
        Weights Over Time
      </p>
      <p className="text-xs text-muted font-mono mb-4">
        {tickers.length} assets · {weights_history.length} rebalancings
      </p>

      <div className="min-w-[560px]">
        {/* Date header */}
        <div className="flex items-end mb-1">
          <div className="w-[72px] shrink-0" />
          <div className="flex-1 flex gap-px">
            {history.map(r => (
              <div
                key={r.date}
                className="flex-1 overflow-hidden"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: 8,
                  color: '#7a6848',
                  height: 44,
                  textAlign: 'left',
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                {r.date.slice(0, 7)}
              </div>
            ))}
          </div>
        </div>

        {/* Asset rows */}
        {tickers.map(ticker => (
          <div key={ticker} className="flex items-center gap-px mb-px">
            <div
              className="w-[72px] shrink-0 text-[#f5f0e8] pr-2 truncate"
              style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}
            >
              {ticker}
            </div>
            <div className="flex-1 flex gap-px">
              {history.map(record => {
                const w = record.weights[ticker] ?? 0
                return (
                  <div
                    key={record.date}
                    className="flex-1 h-5 rounded-[1px] transition-opacity hover:opacity-70"
                    title={`${ticker}  ${record.date}  ${(w * 100).toFixed(1)}%`}
                    style={{ backgroundColor: weightToColor(w) }}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* Colour scale legend */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-muted font-mono">0%</span>
          <div
            className="h-1.5 flex-1 rounded-full"
            style={{ background: 'linear-gradient(to right, #f97316, #f59e0b, #6366f1)' }}
          />
          <span className="text-[10px] text-muted font-mono">40%+</span>
        </div>
      </div>
    </div>
  )
}
