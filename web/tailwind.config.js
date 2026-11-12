/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          950: '#030712', // Deep slate/navy base
          900: '#070d1a',
          800: '#0b1120',
          700: '#111827',
          600: '#1f2937',
        },
        cyber: {
          cyan: '#00F3FF',
          cyanDim: 'rgba(0, 243, 255, 0.15)',
          blue: '#06B6D4',
        },
        alert: {
          red: '#FF0055',
          redDim: 'rgba(255, 0, 85, 0.15)',
          crimson: '#EF4444',
        },
        warn: {
          amber: '#FF9900',
          amberDim: 'rgba(255, 153, 0, 0.15)',
          yellow: '#F59E0B',
        },
        safe: {
          green: '#00FF88',
          greenDim: 'rgba(0, 255, 136, 0.15)',
          emerald: '#10B981',
        },
        platinum: {
          50: '#030712',
          100: '#0B1120',
          200: '#111827',
          300: '#1F2937',
          400: '#334155',
          500: '#64748B',
          600: '#94A3B8',
          700: '#CBD5E1',
          800: '#E2E8F0',
          900: '#F8FAFC',
        },
        mocha: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#1E293B',
          700: '#0F172A',
          800: '#0B1120',
          900: '#030712',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(0, 243, 255, 0.25)',
        'neon-red': '0 0 15px rgba(255, 0, 85, 0.25)',
        'neon-amber': '0 0 15px rgba(255, 153, 0, 0.25)',
        'neon-green': '0 0 15px rgba(0, 255, 136, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radarSweep 4s linear infinite',
      },
      keyframes: {
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
}
