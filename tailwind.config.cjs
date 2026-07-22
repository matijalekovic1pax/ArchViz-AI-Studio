/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#FAFAF8',
          secondary: '#F5F5F3',
          tertiary: '#EEEDE9',
        },
        foreground: {
          DEFAULT: '#1A1A1A',
          secondary: '#4A4A4A',
          muted: '#8A8A8A',
          subtle: '#B0B0B0',
        },
        border: {
          DEFAULT: '#E5E5E0',
          subtle: '#EFEFEA',
          strong: '#D0D0C8',
        },
        accent: {
          DEFAULT: '#C9B99A',
          hover: '#B8A687',
          muted: '#E8E0D0',
        },
        surface: {
          elevated: '#FFFFFF',
          sunken: '#F0F0EC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      spacing: {
        sidebar: '280px',
        panel: '320px',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
        elevated: '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
      keyframes: {
        'slide-down': {
          from: { height: '0', opacity: '0' },
          to: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
        },
        'slide-up': {
          from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
          to: { height: '0', opacity: '0' },
        },
        'cancel-emerge': {
          '0%': { opacity: '0', transform: 'translateX(-14px) scale(0.7)' },
          '55%': { opacity: '1', transform: 'translateX(2px) scale(1.06)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'retry-notice-drop': {
          '0%': { opacity: '0', transform: 'translateY(-10px) scale(0.96)' },
          '70%': { opacity: '1', transform: 'translateY(2px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'liquid-blob': {
          '0%': { opacity: '0', transform: 'translateX(0) scale(0.15)' },
          '30%': { opacity: '1', transform: 'translateX(6px) scale(1.05)' },
          '70%': { opacity: '0.9', transform: 'translateX(18px) scale(0.9)' },
          '100%': { opacity: '0', transform: 'translateX(30px) scale(0)' },
        },
        'liquid-bridge': {
          '0%': { opacity: '0', transform: 'translateX(0) scaleX(0)' },
          '40%': { opacity: '0.6', transform: 'translateX(6px) scaleX(1)' },
          '100%': { opacity: '0', transform: 'translateX(24px) scaleX(0.3)' },
        },
      },
      animation: {
        'slide-down': 'slide-down 220ms ease-out',
        'slide-up': 'slide-up 180ms ease-in',
        'cancel-emerge': 'cancel-emerge 520ms cubic-bezier(0.18, 0.9, 0.22, 1.1)',
        'retry-notice-drop': 'retry-notice-drop 420ms cubic-bezier(0.18, 0.9, 0.22, 1.08)',
        'liquid-blob': 'liquid-blob 520ms cubic-bezier(0.2, 0.9, 0.2, 1)',
        'liquid-bridge': 'liquid-bridge 520ms cubic-bezier(0.2, 0.9, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
