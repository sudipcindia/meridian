import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Frozen master template (proposal/components/proposal/**) — a sibling
    // directory outside this app, pulled in only via a Vite resolve alias
    // (@masterTemplateSrc). Vite's bundler follows that alias fine, but
    // Tailwind's own content scanner does plain-text globbing independent of
    // Vite/module resolution, so without this entry any utility class used
    // ONLY in the frozen template (never elsewhere in src/) gets silently
    // tree-shaken out of the compiled CSS — e.g. left-0/right-0/bottom-0/z-10
    // were missing in production, which is what broke Cover's page-number
    // layout (it was the only page using those classes for its header).
    '../components/proposal/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'clash-display': ['Clash Display', 'sans-serif'],
        'general-sans': ['General Sans', 'sans-serif'],
      },
      colors: {
        'novara-dark': '#0D1A1F',
        'novara-panel': '#122229',
        'novara-teal': '#0FAFBC',
        'novara-orange': '#FF5B04',
        'novara-light': '#E4EEF0',
        'novara-border': 'rgba(228,238,240,0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config
