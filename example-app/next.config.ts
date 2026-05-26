import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const here = dirname(fileURLToPath(import.meta.url))
const candidates = [
  resolve(here, '../.env'),
  resolve(here, '.env'),
]
for (const path of candidates) {
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

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
}

export default nextConfig
