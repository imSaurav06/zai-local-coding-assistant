/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          105: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#10b981', // Muted Emerald primary accent
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        dark: {
          bg: '#141416',       // very dark charcoal graphite main bg
          sidebar: '#0d0d0e',  // slightly darker sidebar bg
          card: '#1e1e20',     // conversation surface/bubbles dark gray
          border: '#2a2a2d',   // soft low-contrast border
          text: '#f3f4f6',     // off-white text
          muted: '#8e9196',    // muted gray secondary text
          hover: '#252528',    // subtle hover gray
          composer: '#1c1c1e'  // slightly elevated composer surface
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
