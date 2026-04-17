import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy (app)
        primary: '#1a1a2e',
        'primary-light': '#16213e',
        accent: '#e94560',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        // Rush design tokens
        rush: {
          bleu: '#002395',
          blanc: '#ffffff',
          rouge: '#ED2939',
          'bg-dark': '#06081A',
          'bg-navy': '#1A1744',
          'bg-subtle': '#f1f5f9',
          'text-muted': '#9ca3af',
        },
      },
      fontFamily: {
        display: ['Black Han Sans', 'sans-serif'],
        body: ['Poppins', 'sans-serif'],
        sans: ['Poppins', 'sans-serif'],
      },
      backgroundImage: {
        'rush-tricolor': 'linear-gradient(180deg, #002395 0%, #ffffff 48%, #ED2939 100%)',
        'rush-tricolor-h': 'linear-gradient(90deg, #002395 0%, #ffffff 48%, #ED2939 100%)',
        'rush-tricolor-dark': 'linear-gradient(180deg, #002395 0%, #1a1744 50%, #ED2939 100%)',
      },
      borderRadius: {
        'rush-sm': '6px',
        'rush-md': '10px',
        'rush-lg': '14px',
        'rush-xl': '18px',
        'rush-2xl': '24px',
      },
      boxShadow: {
        'rush-sm': '0 2px 8px rgba(0,0,0,0.06)',
        'rush-md': '0 4px 16px rgba(0,0,0,0.1)',
        'rush-lg': '0 8px 32px rgba(0,0,0,0.16)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        counter: 'counter 2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
