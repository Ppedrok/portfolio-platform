import { useState, useEffect } from 'react'

// ── Base shimmer block ─────────────────────────────────────────────────────────

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse bg-[#2a1e08] rounded ${className ?? ''}`}
      style={style}
    />
  )
}

// ── Weights skeleton (donut + legend + metrics grid) ──────────────────────────

function WeightsSkeleton() {
  const bars = [82, 58, 72, 44, 62, 30]
  return (
    <div className="bg-card border border-border rounded-panel p-4 space-y-5">
      {/* Donut + legend row */}
      <div className="flex gap-6 items-center">
        {/* Donut placeholder */}
        <div className="relative shrink-0 w-[220px] h-[220px]">
          <Shimmer className="w-full h-full rounded-full" />
          <div className="absolute inset-[55px] rounded-full bg-bg" />
        </div>
        {/* Legend rows */}
        <div className="flex-1 space-y-3 py-2">
          {bars.map((w, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <Shimmer className="w-2.5 h-2.5 rounded-sm shrink-0" />
                <Shimmer className="h-3" style={{ width: `${w}%` }} />
                <Shimmer className="w-9 h-3 shrink-0" />
              </div>
              <Shimmer className="h-[3px] w-full rounded-full ml-4" style={{ opacity: 0.5 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="border-t border-border pt-4">
        <Shimmer className="h-2.5 w-32 mb-3" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-[#0a0804] border border-border rounded-lg p-3 space-y-2">
              <Shimmer className="h-2 w-16 rounded" />
              <Shimmer className="h-5 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Backtest skeleton (equity curve + metrics + heatmap) ──────────────────────

function BacktestSkeleton() {
  return (
    <div className="space-y-4">
      {/* Equity curve */}
      <div className="bg-card border border-border rounded-panel p-4 space-y-3">
        <Shimmer className="h-2.5 w-28" />
        <Shimmer className="w-full h-52 rounded-lg" style={{ opacity: 0.7 }} />
        <div className="flex justify-between">
          {[40, 50, 45, 55, 48].map((w, i) => (
            <Shimmer key={i} className="h-2 rounded" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>

      {/* Metrics hero cards */}
      <div className="bg-card border border-border rounded-panel p-4 space-y-3">
        <Shimmer className="h-2.5 w-36" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <div key={i} className="bg-bg border border-border rounded-panel p-3 space-y-2">
              <Shimmer className="h-2 w-20" />
              <Shimmer className="h-6 w-28" />
              <Shimmer className="h-2 w-16" />
            </div>
          ))}
        </div>
        {/* Table rows */}
        <div className="space-y-1.5 pt-2 border-t border-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-between py-1">
              <Shimmer className="h-2.5 w-24" />
              <Shimmer className="h-2.5 w-16" />
              <Shimmer className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Public SkeletonLoader ─────────────────────────────────────────────────────

export function SkeletonLoader({ variant }: { variant: 'weights' | 'backtest' }) {
  return variant === 'weights' ? <WeightsSkeleton /> : <BacktestSkeleton />
}

// ── ProgressSteps ─────────────────────────────────────────────────────────────

export interface ProgressStep {
  label: string
  /** Cumulative ms from loading start when this step completes and next begins */
  delay: number
}

export function ProgressSteps({
  loading,
  steps,
}: {
  loading: boolean
  steps:   ProgressStep[]
}) {
  const [current, setCurrent] = useState(-1)

  useEffect(() => {
    if (!loading) {
      setCurrent(-1)
      return
    }
    setCurrent(0)
    const timers = steps.map((s, i) =>
      window.setTimeout(() => setCurrent(i + 1), s.delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!loading || current < 0) return null

  return (
    <div className="py-5 space-y-2.5">
      {steps.map((s, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center gap-3">
            {/* Icon */}
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              {done ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2.5 7l3 3 6-6"
                    stroke="#34d399"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : active ? (
                <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] animate-pulse inline-block" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#2a1e08] inline-block" />
              )}
            </span>
            {/* Label */}
            <span
              className={`text-xs font-mono transition-colors duration-300 ${
                done   ? 'text-emerald-400/70' :
                active ? 'text-[#f97316]'      :
                         'text-muted/40'
              }`}
            >
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
