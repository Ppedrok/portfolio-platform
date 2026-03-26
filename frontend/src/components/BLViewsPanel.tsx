/**
 * BLViewsPanel.tsx
 * ----------------
 * Panel for entering Black-Litterman investor views.
 * Each view: [asset dropdown] [>= | <=] [XX.X %/yr] [remove]
 * Only shown when mu_method starts with 'BL'.
 */

import type { BLView } from '../types'

interface Props {
  assets:   string[]
  views:    BLView[]
  onChange: (views: BLView[]) => void
}

const SEL = `
  bg-[#0a0804] border border-[#2a1e08] rounded px-2 py-1 text-xs text-[#f0e8d4]
  font-mono focus:outline-none focus:border-[#f97316] cursor-pointer
`.trim()

export function BLViewsPanel({ assets, views, onChange }: Props) {
  function addView() {
    const next: BLView = { asset: assets[0] ?? '', sign: '>=', value: 8 }
    onChange([...views, next])
  }

  function removeView(i: number) {
    onChange(views.filter((_, idx) => idx !== i))
  }

  function update(i: number, patch: Partial<BLView>) {
    onChange(views.map((v, idx) => idx === i ? { ...v, ...patch } : v))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="terminal-label">Investor Views</span>
        <button
          onClick={addView}
          disabled={assets.length === 0}
          className="text-[10px] font-mono text-[#f97316] hover:text-[#38bdf8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + Add View
        </button>
      </div>

      {views.length === 0 && (
        <p className="text-[10px] text-muted font-mono py-2">
          No views — using pure equilibrium prior (CAPM).
        </p>
      )}

      <div className="space-y-1.5">
        {views.map((view, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* Asset */}
            <select
              value={view.asset}
              onChange={e => update(i, { asset: e.target.value })}
              className={SEL}
              style={{ minWidth: 90 }}
            >
              {assets.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Sign */}
            <select
              value={view.sign}
              onChange={e => update(i, { sign: e.target.value as '>=' | '<=' })}
              className={SEL}
            >
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
            </select>

            {/* Value */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                value={view.value}
                onChange={e => update(i, { value: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-[#0a0804] border border-[#2a1e08] rounded px-2 py-1 text-xs text-[#f0e8d4] font-mono focus:outline-none focus:border-[#f97316] text-right"
              />
              <span className="text-[10px] text-muted font-mono">%/yr</span>
            </div>

            {/* Remove */}
            <button
              onClick={() => removeView(i)}
              className="text-muted hover:text-[#ef4444] text-xs transition-colors ml-auto"
              title="Remove view"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {views.length > 0 && (
        <p className="text-[10px] text-muted font-mono pt-1 leading-relaxed">
          Views are treated as equality constraints in the BL posterior.
          The &gt;=/&lt;= sign indicates the direction of your expectation.
        </p>
      )}
    </div>
  )
}
