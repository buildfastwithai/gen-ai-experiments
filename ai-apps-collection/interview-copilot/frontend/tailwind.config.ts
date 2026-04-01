import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.9)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        revealUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        stream: {
          '0%': { opacity: '0.15' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.15' },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 1.1s ease-in-out infinite',
        'reveal-up': 'revealUp 0.5s ease-out both',
        stream: 'stream 1.4s ease-in-out infinite',
      },
      boxShadow: {
        'soft-xl': '0 12px 30px rgba(15, 23, 42, 0.08)',
        'soft-2xl': '0 20px 48px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
