import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// The Proposal Editor renders the frozen master template's real components
// read-only for its live preview (see src/masterTemplate/pageComponents.ts).
// Those files live in the sibling `proposal/` package, so the dev server
// needs permission to serve outside this app's own root.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@masterTemplateSrc': path.resolve(__dirname, '../components/proposal'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '.')],
    },
  },
})
