/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           '#0f1117',
        card:         '#1a1d27',
        'card-hover': '#1e2130',
        border:       '#2a2d3a',
        muted:        '#8b8fa8',
        indigo:       { DEFAULT: '#6366f1', hover: '#4f46e5', dim: '#6366f120' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px 0 rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
