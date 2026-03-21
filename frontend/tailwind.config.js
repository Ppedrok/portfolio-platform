/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           '#080a0f',
        card:         '#0d1117',
        'card-hover': '#111722',
        border:       '#1e2530',
        muted:        '#8892a4',
        accent: {
          DEFAULT: '#4f8ef7',
          hover:   '#3a7de8',
          dim:     '#4f8ef712',
          soft:    '#4f8ef728',
        },
        positive:     '#00d4aa',
        negative:     '#ff4d6a',
        header:       '#0a0c12',
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', '"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card:  '0 1px 12px 0 rgba(0,0,0,0.6)',
        glow:  '0 0 16px 0 rgba(79,142,247,0.15)',
      },
      borderRadius: {
        panel: '8px',
      },
    },
  },
  plugins: [],
}
