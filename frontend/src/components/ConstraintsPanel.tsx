import { useState } from 'react'
import type { ConstraintRow, TickerMatch } from '../types'

// ── Internal row state ────────────────────────────────────────────────────────
// weight and factor are kept as strings for controlled <input type="number">
interface RowState {
  id:           string
  active:       boolean
  type:         'Assets' | 'All Assets' | 'Classes'
  position:     string
  sign:         '>=' | '<='
  weightStr:    string   // percentage, e.g. "15" = 15%
  isRelative:   boolean
  typeRelative: '' | 'Assets' | 'Classes'
  relative:     string
  factorStr:    string   // multiplier, e.g. "2"
}

function makeRow(): RowState {
  return {
    id:           Math.random().toString(36).slice(2),
    active:       true,
    type:         'Assets',
    position:     '',
    sign:         '>=',
    weightStr:    '',
    isRelative:   false,
    typeRelative: '',
    relative:     '',
    factorStr:    '',
  }
}

function toConstraintRow(r: RowState): ConstraintRow {
  return {
    disabled:      !r.active,
    type:          r.type,
    set:           '',
    position:      r.position,
    sign:          r.sign,
    weight:        r.isRelative || r.weightStr === '' ? '' : Number(r.weightStr) / 100,
    type_relative: r.isRelative ? r.typeRelative : '',
    relative_set:  '',
    relative:      r.isRelative ? r.relative : '',
    factor:        r.isRelative && r.factorStr !== '' ? Number(r.factorStr) : '',
  }
}

// ── Preset examples ───────────────────────────────────────────────────────────
const PRESETS: { label: string; base: Omit<RowState, 'id'> }[] = [
  {
    label: 'BA ≥ 8%',
    base: {
      active: true, type: 'Assets', position: 'BA', sign: '>=',
      weightStr: '8', isRelative: false, typeRelative: '', relative: '', factorStr: '',
    },
  },
  {
    label: 'Max 15% / asset',
    base: {
      active: true, type: 'All Assets', position: '', sign: '<=',
      weightStr: '15', isRelative: false, typeRelative: '', relative: '', factorStr: '',
    },
  },
  {
    label: 'JCI ≤ 2× APA',
    base: {
      active: true, type: 'Assets', position: 'JCI', sign: '<=',
      weightStr: '', isRelative: true, typeRelative: 'Assets', relative: 'APA', factorStr: '2',
    },
  },
]

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  assets:     TickerMatch[]
  onChange:   (rows: ConstraintRow[]) => void
  onLongOnly: (v: boolean) => void
  longOnly:   boolean
}

// ── Main component ────────────────────────────────────────────────────────────
export function ConstraintsPanel({ assets, onChange, onLongOnly, longOnly }: Props) {
  const [rows, setRows] = useState<RowState[]>([])

  function setAndEmit(next: RowState[]) {
    setRows(next)
    onChange(next.map(toConstraintRow))
  }

  function addRow() { setAndEmit([...rows, makeRow()]) }

  function removeRow(id: string) {
    setAndEmit(rows.filter(r => r.id !== id))
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setAndEmit(rows.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function addPreset(preset: typeof PRESETS[number]) {
    setAndEmit([...rows, { ...preset.base, id: Math.random().toString(36).slice(2) }])
  }

  const tickers = assets.map(a => a.ticker)

  return (
    <div className="border-t border-border pt-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono font-semibold text-muted uppercase tracking-widest">
          Portfolio Constraints
        </h3>

        {/* Long Only toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs text-muted">Long Only</span>
          <button
            type="button"
            role="switch"
            aria-checked={longOnly}
            onClick={() => onLongOnly(!longOnly)}
            className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 ${
              longOnly ? 'bg-accent' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 mt-[3px] ${
                longOnly ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Preset pills */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] text-muted uppercase tracking-wide">Presets:</span>
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => addPreset(p)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-accent/25 text-accent bg-accent/8 hover:bg-accent/15 transition-colors font-mono"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Constraint rows */}
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <ConstraintRowUI
              key={row.id}
              row={row}
              tickers={tickers}
              onChange={patch => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
            />
          ))}
        </div>
      )}

      {/* Add button */}
      <button
        type="button"
        onClick={addRow}
        className="text-xs text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors"
      >
        <span className="text-base leading-none">+</span>
        Add Constraint
      </button>
    </div>
  )
}

// ── Single row UI ─────────────────────────────────────────────────────────────
interface RowUIProps {
  row:      RowState
  tickers:  string[]
  onChange: (patch: Partial<RowState>) => void
  onRemove: () => void
}

const INPUT_CLS =
  'bg-bg border border-border rounded-panel px-2 py-1.5 text-xs text-white ' +
  'focus:outline-none focus:border-accent appearance-none'

function ConstraintRowUI({ row, tickers, onChange, onRemove }: RowUIProps) {
  return (
    <div
      className={`rounded-panel border p-3 space-y-2 transition-opacity ${
        row.active ? 'border-border' : 'border-border/30 opacity-50'
      } bg-bg`}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Active */}
        <input
          type="checkbox"
          checked={row.active}
          onChange={e => onChange({ active: e.target.checked })}
          className="accent-accent w-3.5 h-3.5 shrink-0 cursor-pointer"
        />

        {/* Type */}
        <select
          value={row.type}
          onChange={e => onChange({ type: e.target.value as RowState['type'], position: '' })}
          className={INPUT_CLS + ' cursor-pointer'}
        >
          <option value="Assets">Asset</option>
          <option value="All Assets">All Assets</option>
          <option value="Classes">Class</option>
        </select>

        {/* Position: ticker select or class text input */}
        {row.type === 'Assets' && (
          <select
            value={row.position}
            onChange={e => onChange({ position: e.target.value })}
            className={INPUT_CLS + ' cursor-pointer min-w-[80px] flex-1'}
          >
            <option value="">— ticker —</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {row.type === 'Classes' && (
          <input
            type="text"
            placeholder="class name"
            value={row.position}
            onChange={e => onChange({ position: e.target.value })}
            className={INPUT_CLS + ' min-w-[80px] flex-1 placeholder-muted'}
          />
        )}

        {/* Sign */}
        <select
          value={row.sign}
          onChange={e => onChange({ sign: e.target.value as RowState['sign'] })}
          className={INPUT_CLS + ' cursor-pointer'}
        >
          <option value=">=">≥</option>
          <option value="<=">≤</option>
        </select>

        {/* Absolute weight (hidden when relative) */}
        {!row.isRelative && (
          <div className="flex items-center gap-0.5">
            <input
              type="number"
              placeholder="0"
              min={0} max={100} step={0.5}
              value={row.weightStr}
              onChange={e => onChange({ weightStr: e.target.value })}
              className={INPUT_CLS + ' w-16 text-right'}
            />
            <span className="text-xs text-muted">%</span>
          </div>
        )}

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-muted hover:text-red-400 transition-colors text-base leading-none shrink-0"
          aria-label="Remove constraint"
        >
          ×
        </button>
      </div>

      {/* Relative constraint (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => onChange({ isRelative: !row.isRelative })}
          className="text-[10px] text-muted hover:text-accent flex items-center gap-1 transition-colors"
        >
          <span
            className="inline-block transition-transform duration-150"
            style={{ transform: row.isRelative ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
          Relative constraint
        </button>

        {row.isRelative && (
          <div className="mt-2 pl-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted">relative to</span>

            {/* Relative type */}
            <select
              value={row.typeRelative}
              onChange={e => onChange({ typeRelative: e.target.value as RowState['typeRelative'] })}
              className={INPUT_CLS + ' cursor-pointer'}
            >
              <option value="">— type —</option>
              <option value="Assets">Asset</option>
              <option value="Classes">Class</option>
            </select>

            {/* Relative target */}
            {row.typeRelative === 'Assets' ? (
              <select
                value={row.relative}
                onChange={e => onChange({ relative: e.target.value })}
                className={INPUT_CLS + ' cursor-pointer min-w-[80px]'}
              >
                <option value="">— ticker —</option>
                {tickers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <input
                type="text"
                placeholder="class"
                value={row.relative}
                onChange={e => onChange({ relative: e.target.value })}
                className={INPUT_CLS + ' w-24 placeholder-muted'}
              />
            )}

            {/* Factor */}
            <span className="text-xs text-muted">×</span>
            <input
              type="number"
              placeholder="1"
              step={0.1} min={0}
              value={row.factorStr}
              onChange={e => onChange({ factorStr: e.target.value })}
              className={INPUT_CLS + ' w-16 text-right'}
            />
          </div>
        )}
      </div>
    </div>
  )
}
