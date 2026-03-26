/**
 * Sidebar.tsx
 * -----------
 * Fixed left navigation panel — Bloomberg/Koyfin terminal style.
 * Each item scrolls the main content to its corresponding section.
 */

export type SideSection =
  | 'universe'
  | 'configure'
  | 'results'
  | 'backtest'
  | 'analysis'
  | 'docs'

interface NavItem {
  id:      SideSection
  num:     string
  label:   string
  icon:    JSX.Element
  sub?:    string   // optional subtitle
}

// ── SVG micro-icons ───────────────────────────────────────────────────────────

const IconUniverse = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="7" r="5.5"/>
    <path d="M1.5 7h11M7 1.5C5.5 3.5 5 5 5 7s.5 3.5 2 5.5M7 1.5C8.5 3.5 9 5 9 7s-.5 3.5-2 5.5"/>
  </svg>
)
const IconConfigure = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round">
    <path d="M2 4h1.5m7 0H12M3.5 4a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM2 10h4.5m3 0H12M6.5 10a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z"/>
  </svg>
)
const IconResults = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 11.5L4.5 7.5L7 9.5L10 4.5L12.5 6.5"/>
    <path d="M1.5 11.5h11"/>
  </svg>
)
const IconBacktest = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.5 7A4.5 4.5 0 112.5 5"/>
    <path d="M2.5 2v3h3"/>
  </svg>
)
const IconAnalysis = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1.5" y="5" width="3" height="7" rx=".5"/>
    <rect x="5.5" y="2.5" width="3" height="9.5" rx=".5"/>
    <rect x="9.5" y="4" width="3" height="8" rx=".5"/>
  </svg>
)
const IconDocs = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" strokeWidth="1.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="1.5" width="10" height="11" rx="1"/>
    <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3"/>
  </svg>
)

const NAV_ITEMS: NavItem[] = [
  { id: 'universe',  num: '01', label: 'Universe',      icon: <IconUniverse />,  sub: 'Assets & dates'    },
  { id: 'configure', num: '02', label: 'Configure',     icon: <IconConfigure />, sub: 'Model & constraints'},
  { id: 'results',   num: '03', label: 'Optimization',  icon: <IconResults />,   sub: 'Frontier & weights' },
  { id: 'backtest',  num: '04', label: 'Backtest',      icon: <IconBacktest />,  sub: 'Walk-forward'       },
  { id: 'analysis',  num: '05', label: 'Analysis',      icon: <IconAnalysis />,  sub: 'Factors & compare'  },
  { id: 'docs',      num: '06', label: 'Documentation', icon: <IconDocs />,      sub: 'Feature guide'      },
]

interface Props {
  active:     SideSection
  onNavigate: (id: SideSection) => void
  hasData:    boolean   // dims lower sections until assets are loaded
}

export function Sidebar({ active, onNavigate, hasData }: Props) {
  return (
    <aside style={{
      position:        'fixed',
      top:             0,
      left:            0,
      width:           210,
      height:          '100vh',
      display:         'flex',
      flexDirection:   'column',
      background:      '#070504',
      borderRight:     '1px solid #2a1e08',
      zIndex:          100,
      overflowY:       'auto',
    }}>

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding:      '18px 16px 14px',
        borderBottom: '1px solid #2a1e08',
        flexShrink:   0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Amber icon mark */}
          <div style={{
            width:           28,
            height:          28,
            borderRadius:    6,
            background:      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
            boxShadow:       '0 0 14px rgba(245,158,11,0.45)',
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1 10 L4 6 L7 8 L10 3 L13 5" stroke="#070504" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f5f0e8', letterSpacing: '0.12em', fontFamily: '"JetBrains Mono", monospace' }}>
              PortfolioOS
            </div>
            <div style={{ fontSize: 9, color: '#f59e0b', letterSpacing: '0.18em', fontFamily: '"JetBrains Mono", monospace', marginTop: 1 }}>
              QUANT PLATFORM
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '10px 0' }}>
        {NAV_ITEMS.map(({ id, num, label, icon, sub }) => {
          const isActive  = active === id
          const isDimmed  = !hasData && id !== 'universe' && id !== 'docs'
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                width:           '100%',
                display:         'flex',
                alignItems:      'center',
                gap:             10,
                padding:         '9px 14px',
                background:      isActive ? 'rgba(245,158,11,0.10)' : 'transparent',
                border:          'none',
                borderLeftStyle: 'solid',
                borderLeftWidth: 2,
                borderLeftColor: isActive ? '#f59e0b' : 'transparent',
                cursor:          isDimmed ? 'default' : 'pointer',
                opacity:         isDimmed ? 0.35 : 1,
                transition:      'all 0.15s ease',
                textAlign:       'left',
              }}
              onMouseEnter={e => {
                if (!isActive && !isDimmed) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.05)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                }
              }}
            >
              {/* Number badge */}
              <span style={{
                fontSize:    9,
                fontFamily:  '"JetBrains Mono", monospace',
                color:       isActive ? '#f59e0b' : '#3d2e10',
                fontWeight:  700,
                letterSpacing: '0.05em',
                flexShrink:  0,
                width:       18,
              }}>
                {num}
              </span>

              {/* Icon */}
              <span style={{
                color:     isActive ? '#f97316' : '#4a3820',
                flexShrink: 0,
                display:   'flex',
                alignItems: 'center',
              }}>
                {icon}
              </span>

              {/* Label + subtitle */}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize:    11,
                  fontWeight:  isActive ? 600 : 400,
                  color:       isActive ? '#f5f0e8' : '#7a6848',
                  fontFamily:  '"JetBrains Mono", monospace',
                  letterSpacing: '0.04em',
                  whiteSpace:  'nowrap',
                }}>
                  {label}
                </div>
                {sub && (
                  <div style={{
                    fontSize:   9,
                    color:      isActive ? '#f59e0b' : '#3d2e10',
                    fontFamily: '"JetBrains Mono", monospace',
                    marginTop:  1,
                    letterSpacing: '0.06em',
                  }}>
                    {sub}
                  </div>
                )}
              </div>

              {/* Active indicator dot */}
              {isActive && (
                <span style={{
                  marginLeft: 'auto',
                  width:       5,
                  height:      5,
                  borderRadius: '50%',
                  background:  '#f59e0b',
                  flexShrink:  0,
                  boxShadow:   '0 0 6px #f59e0b',
                }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Footer info ──────────────────────────────────────────────────── */}
      <div style={{
        padding:     '12px 14px',
        borderTop:   '1px solid #2a1e08',
        flexShrink:  0,
      }}>
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 5px #22c55e',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 9, color: '#22c55e', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.12em' }}>
            API LIVE
          </span>
        </div>
        {/* Stack info */}
        <div style={{ fontSize: 8.5, color: '#3d2e10', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.5, marginBottom: 8 }}>
          CVXPY · RISKFOLIO<br />
          FAMA-FRENCH · CLARABEL
        </div>
        {/* Author */}
        <div style={{
          fontSize: 8,
          color: '#7a6848',
          fontFamily: '"JetBrains Mono", monospace',
          letterSpacing: '0.10em',
          paddingTop: 6,
          borderTop: '1px solid #2a1e08',
        }}>
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>A. PEDRINI</span>
          <span style={{ display: 'block', marginTop: 1, color: '#3d2e10' }}>© 2025</span>
        </div>
      </div>
    </aside>
  )
}
