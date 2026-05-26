import { afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const rootEnv = resolve(here, '../../.env')
const fallbackEnv = resolve(here, '../.env')
for (const path of [rootEnv, fallbackEnv]) {
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

const baselineUnhandled = [...process.listeners('unhandledRejection')]
const baselineUncaught = [...process.listeners('uncaughtException')]

afterEach(() => {
  for (const fn of process.listeners('unhandledRejection')) {
    if (!baselineUnhandled.includes(fn)) process.off('unhandledRejection', fn)
  }
  for (const fn of process.listeners('uncaughtException')) {
    if (!baselineUncaught.includes(fn)) process.off('uncaughtException', fn)
  }
})
