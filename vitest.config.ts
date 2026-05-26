import { defineConfig } from 'vitest/config'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Load .env before any project's workers fork so process.env mutations
// reach Node and Edge runtimes alike. Real shell exports still win.
const here = dirname(fileURLToPath(import.meta.url))
for (const path of [resolve(here, '../.env'), resolve(here, './.env')]) {
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const idx = trimmed.indexOf('=')
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        test: {
          name: 'integration-node',
          include: ['tests/integration/**/*.node.test.ts'],
          environment: 'node',
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        test: {
          name: 'integration-edge',
          include: ['tests/integration/**/*.edge.test.ts'],
          environment: 'edge-runtime',
        },
      },
    ],
  },
})
