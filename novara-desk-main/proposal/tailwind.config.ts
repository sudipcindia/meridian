import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        desktop: '1440px',
      },
      fontFamily: {
        'clash-display': ['Clash Display', 'sans-serif'],
        'general-sans': ['General Sans', 'sans-serif'],
      },
      colors: {
        'novara-dark': '#0D1A1F',
        'novara-teal': '#0FAFBC',
        'novara-orange': '#FF5B04',
        'novara-light': '#E4EEF0',
      },
    },
  },
  plugins: [],
} satisfies Config
