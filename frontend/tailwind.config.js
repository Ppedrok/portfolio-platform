/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:             '#05070d',
        'bg-secondary': '#080c14',
        card:           '#0b0f1a',
        'card-raised':  '#0f1420',
        border:         '#1a2035',
        'border-bright':'#253050',
        muted:          '#5a6a85',
        'muted-bright': '#8899b8',
        teal:           '#0ea5e9',
        accent: {
          DEFAULT: '#2563eb',
          hover:   '#1d4ed8',
          dim:     '#2563eb14',
          soft:    '#2563eb28',
          glow:    '#2563eb40',
        },
        positive:       '#10b981',
        negative:       '#ef4444',
        warning:        '#f59e0b',
        header:         '#030508',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 32px rgba(0,0,0,0.6)',
        glow: '0 0 20px rgba(37,99,235,0.18)',
      },
      borderRadius: {
        panel: '8px',
      },
    },
  },
  plugins: [],
}
