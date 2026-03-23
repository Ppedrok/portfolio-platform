/**
 * GlobalLoadingBar.tsx
 * --------------------
 * A 2px shimmer bar pinned to the very top of the viewport.
 * Shows whenever any async operation is in progress.
 */

interface Props { loading: boolean }

export function GlobalLoadingBar({ loading }: Props) {
  if (!loading) return null
  return (
    <>
      <style>{`
        @keyframes _glb_slide {
          0%   { transform: translateX(-100%) }
          100% { transform: translateX(380%) }
        }
        @keyframes _glb_fade_in {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
      `}</style>
      <div style={{
        position:   'fixed',
        top:        0,
        left:       0,
        width:      '100%',
        height:     2,
        zIndex:     10000,
        background: '#0b0f1a',
        overflow:   'hidden',
        animation:  '_glb_fade_in 0.15s ease forwards',
      }}>
        <div style={{
          width:      '28%',
          height:     '100%',
          background: 'linear-gradient(90deg, transparent 0%, #2563eb 30%, #38bdf8 60%, #2563eb 80%, transparent 100%)',
          animation:  '_glb_slide 1.1s cubic-bezier(0.4,0,0.2,1) infinite',
        }} />
      </div>
    </>
  )
}
