import { defineConfig } from 'eslint/config'
import prettier from 'eslint-plugin-prettier'
import globals from 'globals'
import js from '@eslint/js'

export default defineConfig([
  {
    files: ['*.js', '*.mjs'],

    languageOptions: {
      globals: globals.node,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },

    ...js.configs.recommended,

    plugins: {
      prettier,
    },

    rules: {
      'linebreak-style': 'off',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
])
