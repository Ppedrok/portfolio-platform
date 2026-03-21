import type { BacktestResponse } from '../types'

interface Props {
  data: BacktestResponse
}

/** Linear interpolation between yellow → orange → red based on weight 0-1 */
function weightToColor(w: number): string {
  if (w < 0.001) return '#1a1d27'
  const t = Math.min(1, w * 2.5)   // amplify: 40%+ → full red
  if (t <= 0.5) {
    // yellow (#fef08a) → orange (#f97316)
    const s = t * 2
    const r = Math.round(254 + (249 - 254) * s)
    const g = Math.round(240 + (115 - 240) * s)
    const b = Math.round(138 + (22  - 138) * s)
    return `rgb(${r},${g},${b})`
  } else {
    // orange (#f97316) → red (#dc2626)
    const s = (t - 0.5) * 2
    const r = Math.round(249 + (220 - 249) * s)
    const g = Math.round(115 + (38  - 115) * s)
    const b = Math.round(22  + (38  - 22)  * s)
    return `rgb(${r},${g},${b})`
  }
}

const MAX_COLS = 40

export function WeightsHeatmap({ data }: Props) {
  const { tickers, weights_history } = data

  // Downsample if too many rebalancing steps
  const step = Math.max(1, Math.floor(weights_history.length / MAX_COLS))
  const history = weights_history.filter((_, i) => i % step === 0)

  return (
    <div className="bg-card rounded-2xl p-5 border border-border overflow-x-auto">
      <h3 className="text-sm font-semibold text-white mb-1">Portfolio Weights Over Time</h3>
      <p className="text-xs text-muted mb-4">
        {tickers.length} assets · {weights_history.length} rebalancing steps
      </p>

      <div className="min-w-[560px]">
        {/* Date header row */}
        <div className="flex items-end mb-1">
          <div className="w-20 shrink-0" />
          <div className="flex-1 flex gap-px">
            {history.map(r => (
              <div
                key={r.date}
                className="flex-1 overflow-hidden"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: 8,
                  color: '#8b8fa8',
                  height: 46,
                  textAlign: 'left',
                  paddingTop: 2,
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
            <div className="w-20 shrink-0 text-xs text-white pr-2 truncate">{ticker}</div>
            <div className="flex-1 flex gap-px">
              {history.map(record => {
                const w = record.weights[ticker] ?? 0
                return (
                  <div
                    key={record.date}
                    className="flex-1 h-6 rounded-[2px] transition-opacity hover:opacity-80"
                    title={`${ticker}  ${record.date}  ${(w * 100).toFixed(1)}%`}
                    style={{ backgroundColor: weightToColor(w) }}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* Colour legend */}
        <div className="flex items-center gap-2 mt-4 text-xs text-muted">
          <span>0%</span>
          <div
            className="h-2 flex-1 rounded-full"
            style={{ background: 'linear-gradient(to right, #fef08a, #f97316, #dc2626)' }}
          />
          <span>40%+</span>
        </div>
      </div>
    </div>
  )
}
