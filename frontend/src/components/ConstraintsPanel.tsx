import { useState, useEffect } from 'react'
import type { ConstraintRow, TickerMatch, AssetGroup } from '../types'

// ── Palette (shared with WeightsChart) ────────────────────────────────────────

const PALETTE = [
  '#4f8ef7', '#00d4aa', '#f59e0b', '#f43f5e', '#a78bfa',
  '#34d399', '#fb923c', '#38bdf8', '#e879f9', '#facc15',
]

// ── Internal types ────────────────────────────────────────────────────────────

interface LimitEntry  { min: number; max: number }         // 0-100 %
interface Group       { id: string; name: string; tickers: string[] }
interface GroupCon    { id: string; group: string; sign: '>=' | '<='; weight: string }
interface RelCon      { id: string; assetA: string; sign: '>=' | '<='; factor: string; assetB: string }
interface GlobalRules { maxSingle: boolean; minAll: boolean }
interface RawRow {
  id: string; active: boolean
  type: 'Assets' | 'All Assets' | 'Classes'
  position: string; sign: '>=' | '<='
  weightStr: string; isRelative: boolean
  typeRelative: '' | 'Assets' | 'Classes'
  relative: string; factorStr: string
}

function uid(): string { return Math.random().toString(36).slice(2) }
function makeRaw(): RawRow {
  return { id: uid(), active: true, type: 'Assets', position: '', sign: '>=', weightStr: '', isRelative: false, typeRelative: '', relative: '', factorStr: '' }
}

// ── buildConstraintRows ───────────────────────────────────────────────────────

function buildConstraintRows(
  assets: TickerMatch[],
  limitMap: Record<string, LimitEntry>,
  groupCons: GroupCon[],
  relCons: RelCon[],
  globalRules: GlobalRules,
  rawRows: RawRow[],
): ConstraintRow[] {
  const out: ConstraintRow[] = []
  const z: Pick<ConstraintRow, 'type_relative' | 'relative_set' | 'relative' | 'factor'> =
    { type_relative: '', relative_set: '', relative: '', factor: '' }

  for (const a of assets) {
    const lim = limitMap[a.ticker] ?? { min: 0, max: 100 }
    if (lim.min > 0)   out.push({ disabled: false, type: 'Assets', set: '', position: a.ticker, sign: '>=', weight: lim.min / 100, ...z })
    if (lim.max < 100) out.push({ disabled: false, type: 'Assets', set: '', position: a.ticker, sign: '<=', weight: lim.max / 100, ...z })
  }

  for (const gc of groupCons) {
    const w = parseFloat(gc.weight)
    if (gc.group && !isNaN(w))
      out.push({ disabled: false, type: 'Classes', set: 'Group', position: gc.group, sign: gc.sign, weight: w / 100, ...z })
  }

  for (const rc of relCons) {
    if (!rc.assetA || !rc.assetB) continue
    const f = parseFloat(rc.factor)
    out.push({ disabled: false, type: 'Assets', set: '', position: rc.assetA, sign: rc.sign, weight: '', type_relative: 'Assets', relative_set: '', relative: rc.assetB, factor: isNaN(f) ? 1 : f })
  }

  if (globalRules.maxSingle) out.push({ disabled: false, type: 'All Assets', set: '', position: '', sign: '<=', weight: 0.25, ...z })
  if (globalRules.minAll)    out.push({ disabled: false, type: 'All Assets', set: '', position: '', sign: '>=', weight: 0.01, ...z })

  for (const r of rawRows) {
    if (!r.active) continue
    out.push({
      disabled: false, type: r.type, set: '', position: r.position, sign: r.sign,
      weight: r.isRelative || r.weightStr === '' ? '' : Number(r.weightStr) / 100,
      type_relative: r.isRelative ? r.typeRelative : '',
      relative_set: '', relative: r.isRelative ? r.relative : '',
      factor: r.isRelative && r.factorStr !== '' ? Number(r.factorStr) : '',
    })
  }

  return out
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const INP =
  'bg-[#0d1117] border border-[#1e2530] rounded px-2 py-1 text-xs text-[#e8eaf0] ' +
  'focus:outline-none focus:border-accent appearance-none placeholder-[#8892a4]'
const SS = { colorScheme: 'dark' as const }

function Toggle({ val, onChange, label }: { val: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button" role="switch" aria-checked={val}
        onClick={() => onChange(!val)}
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${val ? 'bg-accent' : 'bg-[#1e2530]'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform mt-[3px] ${val ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
      <span className="text-xs text-muted font-mono">{label}</span>
    </label>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  assets:         TickerMatch[]
  longOnly:       boolean
  onChange:       (rows: ConstraintRow[]) => void
  onGroupsChange: (groups: AssetGroup[]) => void
  onLongOnly:     (v: boolean) => void
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConstraintsPanel({ assets, longOnly, onChange, onGroupsChange, onLongOnly }: Props) {
  type Tab = 'limits' | 'groups' | 'advanced'
  const [tab,          setTab]          = useState<Tab>('limits')
  const [limitMap,     setLimitMap]     = useState<Record<string, LimitEntry>>({})
  const [lockOpen,     setLockOpen]     = useState<Record<string, boolean>>({})
  const [lockInput,    setLockInput]    = useState<Record<string, string>>({})
  const [groups,       setGroups]       = useState<Group[]>([])
  const [groupCons,    setGroupCons]    = useState<GroupCon[]>([])
  const [relCons,      setRelCons]      = useState<RelCon[]>([])
  const [relForm,      setRelForm]      = useState({ assetA: '', sign: '>=' as '>=' | '<=', factor: '1', assetB: '' })
  const [globalRules,  setGlobalRules]  = useState<GlobalRules>({ maxSingle: false, minAll: false })
  const [rawRows,      setRawRows]      = useState<RawRow[]>([])
  const [showRaw,      setShowRaw]      = useState(false)

  const tickers = assets.map(a => a.ticker)

  function emit(
    lm = limitMap, gc = groupCons, rc = relCons,
    gr = globalRules, rr = rawRows,
  ) {
    onChange(buildConstraintRows(assets, lm, gc, rc, gr, rr))
  }

  // Re-emit when asset list changes (drops removed assets from output automatically)
  useEffect(() => {
    emit()
  }, [assets]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab 1 ─────────────────────────────────────────────────────────────────

  function setLim(ticker: string, patch: Partial<LimitEntry>) {
    const cur = limitMap[ticker] ?? { min: 0, max: 100 }
    const next = { ...limitMap, [ticker]: { ...cur, ...patch } }
    setLimitMap(next); emit(next)
  }

  function applyLock(ticker: string) {
    const v = Math.max(0, Math.min(100, parseFloat(lockInput[ticker] ?? '') || 0))
    setLim(ticker, { min: v, max: v })
    setLockOpen(p => ({ ...p, [ticker]: false }))
  }

  // ── Tab 2 ─────────────────────────────────────────────────────────────────

  function setAndEmitGroups(next: Group[]) {
    setGroups(next)
    onGroupsChange(next.map(g => ({ name: g.name, tickers: g.tickers })))
  }

  function addGroup() { setAndEmitGroups([...groups, { id: uid(), name: '', tickers: [] }]) }

  function updateGroup(id: string, patch: Partial<Group>) {
    setAndEmitGroups(groups.map(g => g.id === id ? { ...g, ...patch } : g))
  }

  function removeGroup(id: string) {
    const g = groups.find(x => x.id === id)
    setAndEmitGroups(groups.filter(x => x.id !== id))
    if (g) {
      const next = groupCons.filter(gc => gc.group !== g.name)
      setGroupCons(next); emit(limitMap, next)
    }
  }

  function addGC(groupName: string) {
    const next = [...groupCons, { id: uid(), group: groupName, sign: '<=' as const, weight: '' }]
    setGroupCons(next); emit(limitMap, next)
  }

  function updateGC(id: string, patch: Partial<GroupCon>) {
    const next = groupCons.map(gc => gc.id === id ? { ...gc, ...patch } : gc)
    setGroupCons(next); emit(limitMap, next)
  }

  function removeGC(id: string) {
    const next = groupCons.filter(gc => gc.id !== id)
    setGroupCons(next); emit(limitMap, next)
  }

  // ── Tab 3 ─────────────────────────────────────────────────────────────────

  function addRel() {
    if (!relForm.assetA || !relForm.assetB || relForm.assetA === relForm.assetB) return
    const next = [...relCons, { id: uid(), ...relForm }]
    setRelCons(next); emit(limitMap, groupCons, next)
    setRelForm({ assetA: '', sign: '>=', factor: '1', assetB: '' })
  }

  function removeRel(id: string) {
    const next = relCons.filter(rc => rc.id !== id)
    setRelCons(next); emit(limitMap, groupCons, next)
  }

  function setRule(k: keyof GlobalRules, v: boolean) {
    const next = { ...globalRules, [k]: v }
    setGlobalRules(next); emit(limitMap, groupCons, relCons, next)
  }

  function addRaw() {
    const next = [...rawRows, makeRaw()]
    setRawRows(next); emit(limitMap, groupCons, relCons, globalRules, next)
  }

  function updateRaw(id: string, patch: Partial<RawRow>) {
    const next = rawRows.map(r => r.id === id ? { ...r, ...patch } : r)
    setRawRows(next); emit(limitMap, groupCons, relCons, globalRules, next)
  }

  function removeRaw(id: string) {
    const next = rawRows.filter(r => r.id !== id)
    setRawRows(next); emit(limitMap, groupCons, relCons, globalRules, next)
  }

  // ── Badge counts ─────────────────────────────────────────────────────────

  const c1 = assets.filter(a => { const l = limitMap[a.ticker]; return l && (l.min > 0 || l.max < 100) }).length
  const c2 = groupCons.filter(gc => gc.group && gc.weight !== '').length
  const c3 = relCons.length + (globalRules.maxSingle ? 1 : 0) + (globalRules.minAll ? 1 : 0) + rawRows.filter(r => r.active).length
  const sumMins = assets.reduce((s, a) => s + (limitMap[a.ticker]?.min ?? 0), 0)

  const TABS: { id: Tab; label: string; n: number }[] = [
    { id: 'limits',   label: '📊 Asset Limits',        n: c1 },
    { id: 'groups',   label: '🏷️ Groups & Sectors',    n: c2 },
    { id: 'advanced', label: '⚙️ Relative & Advanced',  n: c3 },
  ]

  return (
    <div className="border-t border-border pt-5 space-y-4">
      <h3 className="text-[10px] font-mono font-semibold text-muted uppercase tracking-widest">
        Portfolio Constraints
      </h3>

      {/* Tab switcher */}
      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[11px] font-mono flex items-center gap-1.5 transition-colors relative ${
              tab === t.id
                ? 'text-accent border-b-2 border-accent -mb-px'
                : 'text-muted hover:text-[#e8eaf0]'
            }`}
          >
            {t.label}
            {t.n > 0 && (
              <span className={`text-[9px] px-1 py-px rounded font-bold min-w-[16px] text-center leading-tight ${
                tab === t.id ? 'bg-accent text-white' : 'bg-accent/20 text-accent'
              }`}>{t.n}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[60px]">
        {tab === 'limits' && (
          <Tab1
            assets={assets}
            limitMap={limitMap}
            lockOpen={lockOpen}
            lockInput={lockInput}
            sumMins={sumMins}
            setLim={setLim}
            toggleLock={ticker => setLockOpen(p => ({ ...p, [ticker]: !p[ticker] }))}
            closeLock={ticker => setLockOpen(p => ({ ...p, [ticker]: false }))}
            setLockInputVal={(ticker, val) => setLockInput(p => ({ ...p, [ticker]: val }))}
            applyLock={applyLock}
          />
        )}
        {tab === 'groups' && (
          <Tab2
            tickers={tickers}
            groups={groups}
            groupCons={groupCons}
            onAddGroup={addGroup}
            onUpdateGroup={updateGroup}
            onRemoveGroup={removeGroup}
            onAddGC={addGC}
            onUpdateGC={updateGC}
            onRemoveGC={removeGC}
          />
        )}
        {tab === 'advanced' && (
          <Tab3
            tickers={tickers}
            relCons={relCons}
            relForm={relForm}
            onRelFormChange={setRelForm}
            globalRules={globalRules}
            longOnly={longOnly}
            onAddRel={addRel}
            onRemoveRel={removeRel}
            onRule={setRule}
            onLongOnly={onLongOnly}
            showRaw={showRaw}
            onToggleRaw={() => setShowRaw(p => !p)}
            rawRows={rawRows}
            onAddRaw={addRaw}
            onUpdateRaw={updateRaw}
            onRemoveRaw={removeRaw}
          />
        )}
      </div>

      {/* Active summary pills */}
      <SummaryPills
        assets={assets}
        limitMap={limitMap}
        groupCons={groupCons}
        relCons={relCons}
        globalRules={globalRules}
      />
    </div>
  )
}

// ── TAB 1: Asset Limits ───────────────────────────────────────────────────────

interface Tab1Props {
  assets:          TickerMatch[]
  limitMap:        Record<string, LimitEntry>
  lockOpen:        Record<string, boolean>
  lockInput:       Record<string, string>
  sumMins:         number
  setLim:          (ticker: string, patch: Partial<LimitEntry>) => void
  toggleLock:      (ticker: string) => void
  closeLock:       (ticker: string) => void
  setLockInputVal: (ticker: string, val: string) => void
  applyLock:       (ticker: string) => void
}

function Tab1({ assets, limitMap, lockOpen, lockInput, sumMins, setLim, toggleLock, closeLock, setLockInputVal, applyLock }: Tab1Props) {
  if (assets.length === 0)
    return <p className="text-xs text-muted font-mono py-6 text-center">Add at least 2 assets to set per-asset limits.</p>

  const minErr     = sumMins > 100
  const hasConflict = assets.some(a => { const l = limitMap[a.ticker]; return l && l.min > l.max })

  return (
    <div className="space-y-2">
      {(minErr || hasConflict) && (
        <div className="bg-negative/10 border border-negative/30 rounded px-3 py-2 text-[11px] font-mono text-negative space-y-0.5">
          {minErr     && <div>Sum of minimums: {sumMins.toFixed(0)}% — exceeds 100%.</div>}
          {hasConflict && <div>Some min weights exceed their max.</div>}
        </div>
      )}

      {assets.map((a, i) => {
        const color  = PALETTE[i % PALETTE.length]
        const lim    = limitMap[a.ticker] ?? { min: 0, max: 100 }
        const isExc  = lim.max === 0
        const isLoc  = lim.min === lim.max && lim.min > 0
        const err    = lim.min > lim.max

        return (
          <div
            key={a.ticker}
            className={`bg-[#080a0f] border rounded-lg p-3 ${err ? 'border-negative/40' : 'border-[#1e2530]'}`}
          >
            {/* Header row */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0"
                style={{ background: color + '22', color, border: `1px solid ${color}44` }}
              >
                {a.ticker}
              </span>
              {isExc && <span className="text-[9px] px-1.5 py-0.5 rounded bg-negative/15 text-negative font-mono">EXCLUDED</span>}
              {isLoc && <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: '#f59e0b22', color: '#f59e0b' }}>LOCKED {lim.min}%</span>}
              <div className="ml-auto flex gap-1">
                <button type="button"
                  onClick={() => setLim(a.ticker, { min: 0, max: 0 })}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-negative/30 text-negative hover:bg-negative/10 transition-colors"
                >Exclude</button>
                <button type="button"
                  onClick={() => toggleLock(a.ticker)}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors"
                  style={{ borderColor: '#f59e0b44', color: '#f59e0b' }}
                >Lock</button>
                <button type="button"
                  onClick={() => setLim(a.ticker, { min: 0, max: 100 })}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#1e2530] text-muted hover:text-[#e8eaf0] transition-colors"
                >Reset</button>
              </div>
            </div>

            {/* Lock input */}
            {lockOpen[a.ticker] && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-muted font-mono">Lock at:</span>
                <input
                  type="number" min={0} max={100} step={1} placeholder="%"
                  value={lockInput[a.ticker] ?? ''}
                  onChange={e => setLockInputVal(a.ticker, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyLock(a.ticker)}
                  className={INP + ' w-16 text-right'}
                />
                <span className="text-[10px] text-muted font-mono">%</span>
                <button type="button" onClick={() => applyLock(a.ticker)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded transition-colors"
                  style={{ background: '#f59e0b22', color: '#f59e0b' }}
                >Apply</button>
                <button type="button" onClick={() => closeLock(a.ticker)}
                  className="text-[10px] text-muted hover:text-[#e8eaf0] font-mono">×</button>
              </div>
            )}

            {/* Min / Max sliders */}
            {(['min', 'max'] as const).map(key => (
              <div key={key} className="grid grid-cols-[36px_1fr_54px] items-center gap-2 mb-1.5 last:mb-0">
                <span
                  className="text-[10px] font-mono font-semibold uppercase tracking-wide"
                  style={{ color: key === 'min' ? '#00d4aa' : '#f43f5e' }}
                >{key}</span>
                <input
                  type="range" min={0} max={100} step={1}
                  value={lim[key]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    setLim(a.ticker, key === 'min' ? { min: v } : { max: v })
                  }}
                  style={{ accentColor: color }}
                  className="w-full"
                />
                <div className="flex items-center">
                  <input
                    type="number" min={0} max={100} step={1}
                    value={lim[key]}
                    onChange={e => setLim(a.ticker, key === 'min' ? { min: Number(e.target.value) || 0 } : { max: Number(e.target.value) || 0 })}
                    className={INP + ' w-10 text-right py-0.5 px-1 text-[11px]'}
                  />
                  <span className="text-[10px] text-muted font-mono ml-0.5">%</span>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── TAB 2: Groups & Sectors ───────────────────────────────────────────────────

interface Tab2Props {
  tickers:       string[]
  groups:        Group[]
  groupCons:     GroupCon[]
  onAddGroup:    () => void
  onUpdateGroup: (id: string, patch: Partial<Group>) => void
  onRemoveGroup: (id: string) => void
  onAddGC:       (groupName: string) => void
  onUpdateGC:    (id: string, patch: Partial<GroupCon>) => void
  onRemoveGC:    (id: string) => void
}

function Tab2({ tickers, groups, groupCons, onAddGroup, onUpdateGroup, onRemoveGroup, onAddGC, onUpdateGC, onRemoveGC }: Tab2Props) {
  const assignedSet = new Set(groups.flatMap(g => g.tickers))

  return (
    <div className="space-y-4">

      {/* Define Groups */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Define Groups</span>
          <button type="button" onClick={onAddGroup}
            className="text-[10px] font-mono text-accent border border-accent/30 px-2 py-0.5 rounded hover:bg-accent/10 transition-colors flex items-center gap-1"
          >+ New Group</button>
        </div>

        {groups.length === 0 ? (
          <p className="text-[10px] text-muted font-mono py-4 text-center border border-dashed border-[#1e2530] rounded">
            Create groups to apply sector-level constraints.
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map((g, gi) => {
              const color = PALETTE[gi % PALETTE.length]
              return (
                <div key={g.id} className="bg-[#080a0f] border border-[#1e2530] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text" placeholder="Group name (e.g. Tech)"
                      value={g.name}
                      onChange={e => onUpdateGroup(g.id, { name: e.target.value })}
                      className={INP + ' flex-1 text-[11px]'}
                      style={{ borderColor: color + '44' }}
                    />
                    <button type="button" onClick={() => onRemoveGroup(g.id)}
                      className="text-muted hover:text-negative transition-colors text-sm shrink-0">×</button>
                  </div>

                  {/* Ticker assignment chips */}
                  <div className="flex flex-wrap gap-1">
                    {tickers.length === 0
                      ? <span className="text-[10px] text-muted font-mono">Add assets first.</span>
                      : tickers.map(t => {
                          const inThis  = g.tickers.includes(t)
                          const inOther = !inThis && assignedSet.has(t)
                          return (
                            <button key={t} type="button" disabled={inOther}
                              onClick={() => {
                                const next = inThis ? g.tickers.filter(x => x !== t) : [...g.tickers, t]
                                onUpdateGroup(g.id, { tickers: next })
                              }}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                                inOther ? 'opacity-30 cursor-not-allowed border-border text-muted' : 'cursor-pointer'
                              }`}
                              style={inThis
                                ? { borderColor: color + '80', backgroundColor: color + '22', color }
                                : { borderColor: '#1e2530', color: '#8892a4' }
                              }
                            >{t}</button>
                          )
                        })
                    }
                  </div>

                  {/* Quick-add constraint for this group */}
                  {g.name && (
                    <div className="mt-2 pt-2 border-t border-[#1e2530] flex items-center gap-2">
                      <span className="text-[10px] text-muted font-mono">Constraint:</span>
                      <button type="button" onClick={() => onAddGC(g.name)}
                        className="text-[10px] font-mono text-accent border border-accent/30 px-2 py-0.5 rounded hover:bg-accent/10 transition-colors">
                        + Rule for "{g.name}"
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Group Constraints */}
      {groupCons.length > 0 && (
        <div>
          <span className="text-[10px] font-mono text-muted uppercase tracking-widest block mb-2">Group Constraints</span>
          <div className="space-y-1.5">
            {groupCons.map(gc => {
              const gi    = groups.findIndex(g => g.name === gc.group)
              const color = gi >= 0 ? PALETTE[gi % PALETTE.length] : '#8892a4'
              return (
                <div key={gc.id} className="flex items-center gap-2 bg-[#080a0f] border border-[#1e2530] rounded-lg px-3 py-2">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded shrink-0"
                    style={{ background: color + '22', color, border: `1px solid ${color}44` }}>
                    {gc.group || '—'}
                  </span>
                  <select value={gc.sign} onChange={e => onUpdateGC(gc.id, { sign: e.target.value as GroupCon['sign'] })}
                    className={INP + ' cursor-pointer w-16'} style={SS}>
                    <option value=">=">≥</option>
                    <option value="<=">≤</option>
                  </select>
                  <div className="flex items-center gap-0.5">
                    <input type="number" min={0} max={100} step={1} placeholder="0"
                      value={gc.weight} onChange={e => onUpdateGC(gc.id, { weight: e.target.value })}
                      className={INP + ' w-16 text-right'} />
                    <span className="text-[10px] text-muted font-mono">%</span>
                  </div>
                  <button type="button" onClick={() => onRemoveGC(gc.id)}
                    className="ml-auto text-muted hover:text-negative transition-colors leading-none">×</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB 3: Relative & Advanced ────────────────────────────────────────────────

interface Tab3Props {
  tickers:        string[]
  relCons:        RelCon[]
  relForm:        { assetA: string; sign: '>=' | '<='; factor: string; assetB: string }
  onRelFormChange: (f: { assetA: string; sign: '>=' | '<='; factor: string; assetB: string }) => void
  globalRules:    GlobalRules
  longOnly:       boolean
  onAddRel:       () => void
  onRemoveRel:    (id: string) => void
  onRule:         (k: keyof GlobalRules, v: boolean) => void
  onLongOnly:     (v: boolean) => void
  showRaw:        boolean
  onToggleRaw:    () => void
  rawRows:        RawRow[]
  onAddRaw:       () => void
  onUpdateRaw:    (id: string, patch: Partial<RawRow>) => void
  onRemoveRaw:    (id: string) => void
}

function Tab3({
  tickers, relCons, relForm, onRelFormChange,
  globalRules, longOnly, onAddRel, onRemoveRel, onRule, onLongOnly,
  showRaw, onToggleRaw, rawRows, onAddRaw, onUpdateRaw, onRemoveRaw,
}: Tab3Props) {
  const canAdd = relForm.assetA !== '' && relForm.assetB !== '' && relForm.assetA !== relForm.assetB

  return (
    <div className="space-y-5">

      {/* Relative Constraints */}
      <div>
        <span className="text-[10px] font-mono text-muted uppercase tracking-widest block mb-2">Relative Constraints</span>

        {/* Form */}
        <div className="flex items-center gap-2 flex-wrap bg-[#080a0f] border border-[#1e2530] rounded-lg p-3">
          <select value={relForm.assetA}
            onChange={e => onRelFormChange({ ...relForm, assetA: e.target.value })}
            className={INP + ' cursor-pointer'} style={SS}>
            <option value="">Asset A</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={relForm.sign}
            onChange={e => onRelFormChange({ ...relForm, sign: e.target.value as '>=' | '<=' })}
            className={INP + ' cursor-pointer w-16'} style={SS}>
            <option value=">=">≥</option>
            <option value="<=">≤</option>
          </select>
          <input type="number" min={0} step={0.1} placeholder="1.0"
            value={relForm.factor}
            onChange={e => onRelFormChange({ ...relForm, factor: e.target.value })}
            className={INP + ' w-16 text-right'} />
          <span className="text-xs text-muted font-mono">×</span>
          <select value={relForm.assetB}
            onChange={e => onRelFormChange({ ...relForm, assetB: e.target.value })}
            className={INP + ' cursor-pointer'} style={SS}>
            <option value="">Asset B</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" onClick={onAddRel} disabled={!canAdd}
            className="text-[11px] font-mono px-3 py-1 bg-accent/20 text-accent rounded border border-accent/30 hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Add
          </button>
        </div>

        {/* Pills list */}
        {relCons.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {relCons.map(rc => (
              <span key={rc.id}
                className="flex items-center gap-1.5 bg-[#080a0f] border border-[#1e2530] rounded-full px-3 py-1 text-[11px] font-mono">
                <span className="text-accent">{rc.assetA}</span>
                <span className="text-muted">{rc.sign === '>=' ? '≥' : '≤'}</span>
                <span className="text-[#e8eaf0]">{rc.factor}×</span>
                <span className="text-accent">{rc.assetB}</span>
                <button type="button" onClick={() => onRemoveRel(rc.id)}
                  className="text-muted hover:text-negative ml-1 leading-none">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Global Rules */}
      <div>
        <span className="text-[10px] font-mono text-muted uppercase tracking-widest block mb-2">Global Rules</span>
        <div className="bg-[#080a0f] border border-[#1e2530] rounded-lg p-3 space-y-3">
          <Toggle val={longOnly}              onChange={onLongOnly}                 label="Long Only (no short positions)" />
          <Toggle val={globalRules.maxSingle} onChange={v => onRule('maxSingle', v)} label="No single asset > 25%" />
          <Toggle val={globalRules.minAll}    onChange={v => onRule('minAll', v)}    label="All assets ≥ 1% (avoid near-zero weights)" />
        </div>
      </div>

      {/* Raw Constraints — collapsible */}
      <div>
        <button type="button" onClick={onToggleRaw}
          className="text-[10px] font-mono text-muted hover:text-accent flex items-center gap-1.5 transition-colors">
          <span>{showRaw ? '▾' : '▸'}</span>
          Advanced (Riskfolio format)
          {rawRows.filter(r => r.active).length > 0 && (
            <span className="bg-accent/20 text-accent text-[9px] px-1 rounded ml-1">
              {rawRows.filter(r => r.active).length}
            </span>
          )}
        </button>

        {showRaw && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] text-muted font-mono italic border-l-2 border-border pl-2">
              For advanced users familiar with riskfolio constraint format.
            </p>
            {rawRows.map(r => (
              <RawRowUI
                key={r.id} row={r} tickers={tickers}
                onChange={p => onUpdateRaw(r.id, p)}
                onRemove={() => onRemoveRaw(r.id)}
              />
            ))}
            <button type="button" onClick={onAddRaw}
              className="text-xs text-accent hover:opacity-80 flex items-center gap-1.5 transition-colors mt-1">
              <span className="text-base leading-none">+</span> Add Raw Constraint
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Raw row UI (preserved from original) ─────────────────────────────────────

function RawRowUI({ row, tickers, onChange, onRemove }: {
  row: RawRow; tickers: string[]
  onChange: (p: Partial<RawRow>) => void; onRemove: () => void
}) {
  return (
    <div className={`rounded border p-3 space-y-2 bg-[#0d1117] ${row.active ? 'border-[#1e2530]' : 'border-[#1e2530]/30 opacity-50'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <input type="checkbox" checked={row.active} onChange={e => onChange({ active: e.target.checked })}
          className="accent-accent w-3.5 h-3.5 shrink-0 cursor-pointer" />
        <select value={row.type} onChange={e => onChange({ type: e.target.value as RawRow['type'], position: '' })}
          className={INP + ' cursor-pointer'} style={SS}>
          <option value="Assets">Asset</option>
          <option value="All Assets">All Assets</option>
          <option value="Classes">Class</option>
        </select>
        {row.type === 'Assets' && (
          <select value={row.position} onChange={e => onChange({ position: e.target.value })}
            className={INP + ' cursor-pointer min-w-[80px] flex-1'} style={SS}>
            <option value="">— ticker —</option>
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {row.type === 'Classes' && (
          <input type="text" placeholder="class name" value={row.position}
            onChange={e => onChange({ position: e.target.value })}
            className={INP + ' min-w-[80px] flex-1'} />
        )}
        <select value={row.sign} onChange={e => onChange({ sign: e.target.value as RawRow['sign'] })}
          className={INP + ' cursor-pointer'} style={SS}>
          <option value=">=">≥</option>
          <option value="<=">≤</option>
        </select>
        {!row.isRelative && (
          <div className="flex items-center gap-0.5">
            <input type="number" placeholder="0" min={0} max={100} step={0.5}
              value={row.weightStr} onChange={e => onChange({ weightStr: e.target.value })}
              className={INP + ' w-16 text-right'} />
            <span className="text-xs text-muted font-mono">%</span>
          </div>
        )}
        <button type="button" onClick={onRemove}
          className="ml-auto text-muted hover:text-negative transition-colors text-base leading-none shrink-0">×</button>
      </div>

      <div>
        <button type="button" onClick={() => onChange({ isRelative: !row.isRelative })}
          className="text-[10px] text-muted hover:text-accent flex items-center gap-1 transition-colors">
          <span style={{ display: 'inline-block', transform: row.isRelative ? 'rotate(90deg)' : 'none' }}>▶</span>
          Relative constraint
        </button>
        {row.isRelative && (
          <div className="mt-2 pl-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted">relative to</span>
            <select value={row.typeRelative} onChange={e => onChange({ typeRelative: e.target.value as RawRow['typeRelative'] })}
              className={INP + ' cursor-pointer'} style={SS}>
              <option value="">— type —</option>
              <option value="Assets">Asset</option>
              <option value="Classes">Class</option>
            </select>
            {row.typeRelative === 'Assets' ? (
              <select value={row.relative} onChange={e => onChange({ relative: e.target.value })}
                className={INP + ' cursor-pointer min-w-[80px]'} style={SS}>
                <option value="">— ticker —</option>
                {tickers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <input type="text" placeholder="class" value={row.relative}
                onChange={e => onChange({ relative: e.target.value })}
                className={INP + ' w-24'} />
            )}
            <span className="text-xs text-muted font-mono">×</span>
            <input type="number" placeholder="1" step={0.1} min={0}
              value={row.factorStr} onChange={e => onChange({ factorStr: e.target.value })}
              className={INP + ' w-16 text-right'} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Active Summary Pills ──────────────────────────────────────────────────────

function SummaryPills({ assets, limitMap, groupCons, relCons, globalRules }: {
  assets: TickerMatch[]
  limitMap: Record<string, LimitEntry>
  groupCons: GroupCon[]
  relCons: RelCon[]
  globalRules: GlobalRules
}) {
  const pills: { key: string; label: string }[] = []

  for (const a of assets) {
    const lim = limitMap[a.ticker]
    if (!lim) continue
    if (lim.max === 0) { pills.push({ key: `exc-${a.ticker}`, label: `${a.ticker} EXCLUDED` }); continue }
    if (lim.min > 0)   pills.push({ key: `min-${a.ticker}`, label: `${a.ticker} ≥ ${lim.min}%` })
    if (lim.max < 100) pills.push({ key: `max-${a.ticker}`, label: `${a.ticker} ≤ ${lim.max}%` })
  }

  for (const gc of groupCons)
    if (gc.group && gc.weight !== '')
      pills.push({ key: `gc-${gc.id}`, label: `${gc.group} ${gc.sign === '>=' ? '≥' : '≤'} ${gc.weight}%` })

  for (const rc of relCons)
    if (rc.assetA && rc.assetB)
      pills.push({ key: `rc-${rc.id}`, label: `${rc.assetA} ${rc.sign === '>=' ? '≥' : '≤'} ${rc.factor}× ${rc.assetB}` })

  if (globalRules.maxSingle) pills.push({ key: 'g-max', label: 'All ≤ 25%' })
  if (globalRules.minAll)    pills.push({ key: 'g-min', label: 'All ≥ 1%' })

  if (pills.length === 0) return null

  const shown  = pills.slice(0, 12)
  const extras = pills.length - shown.length

  return (
    <div className="pt-2 border-t border-border">
      <span className="text-[9px] font-mono text-muted uppercase tracking-widest">Active:</span>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {shown.map(p => (
          <span key={p.key}
            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">
            {p.label}
          </span>
        ))}
        {extras > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e2530] text-muted">
            +{extras} more
          </span>
        )}
      </div>
    </div>
  )
}
