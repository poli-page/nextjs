import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const restrictedNodeApis = [
  'fs', 'fs/promises', 'path', 'os', 'stream', 'child_process', 'cluster',
  'node:fs', 'node:fs/promises', 'node:path', 'node:os', 'node:stream',
  'node:child_process', 'node:cluster', 'node:buffer',
]

export default [
  {
    ignores: ['dist/', 'example-app/', 'node_modules/'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-restricted-imports': ['error', { paths: restrictedNodeApis.map(name => ({ name, message: 'Edge-runtime incompatible — src/ may only use Web standard APIs.' })) }],
      'no-restricted-globals': ['error',
        { name: 'Buffer', message: 'Edge-runtime incompatible. Use Uint8Array.' },
        { name: '__dirname', message: 'Not available in ESM / Edge.' },
        { name: '__filename', message: 'Not available in ESM / Edge.' },
      ],
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-default-export': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
  },
]
