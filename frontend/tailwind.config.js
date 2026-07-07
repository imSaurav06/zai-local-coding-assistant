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
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // primary accent
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        dark: {
          bg: '#0A0E1A',      // ultra dark navy
          card: '#121826',    // slightly lighter navy card
          border: '#1E293B',  // slate-800
          text: '#F8FAFC',    // slate-50
          muted: '#94A3B8',   // slate-400
          hover: '#1E2942'    // card hover accent
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
