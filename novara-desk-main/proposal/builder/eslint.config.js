import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Deliberately just the two long-stable hook rules (correctness),
      // not the plugin's full "recommended" preset — that preset now also
      // bundles experimental React Compiler rules (set-state-in-effect,
      // refs, immutability, preserve-manual-memoization) that flag the
      // standard "setLoading(true) inside a data-fetching effect" pattern
      // used consistently and correctly throughout this codebase. Adopting
      // those would mean rewriting the core data-loading/autosave hooks —
      // out of scope for a hardening pass that must not change approved
      // workflows.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
)
