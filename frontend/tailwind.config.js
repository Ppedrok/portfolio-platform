/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:             '#070504',
        'bg-secondary': '#0a0804',
        card:           '#100d06',
        'card-raised':  '#181208',
        border:         '#2a1e08',
        'border-bright':'#3d2e10',
        muted:          '#7a6848',
        'muted-bright': '#a08550',
        teal:           '#f97316',   // orange replaces teal as secondary accent
        accent: {
          DEFAULT: '#f59e0b',
          hover:   '#d97706',
          dim:     '#f59e0b14',
          soft:    '#f59e0b28',
          glow:    '#f59e0b40',
        },
        positive:       '#22c55e',
        negative:       '#ef4444',
        warning:        '#f97316',
        header:         '#040302',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 32px rgba(0,0,0,0.6)',
        glow: '0 0 20px rgba(245,158,11,0.22)',
      },
      borderRadius: {
        panel: '8px',
      },
    },
  },
  plugins: [],
}
