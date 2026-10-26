import { describe, it, expect } from 'vitest'
import { createPoliPageClient } from '../../src/index.js'

const apiKey = process.env.POLI_PAGE_API_KEY ?? ''
// Only ever render with a sandbox key: other environments are counted.
const skip = !apiKey.startsWith('pp_sandbox_')

describe.skipIf(skip)('render welcome against live API (node runtime)', () => {
  it('returns a PDF', async () => {
    const client = createPoliPageClient({
      apiKey,
      ...(process.env.POLI_PAGE_TEST_BASE_URL
        ? { baseUrl: process.env.POLI_PAGE_TEST_BASE_URL }
        : {}),
    })
    const bytes = await client.render.pdf({
      project: 'getting-started',
      template: 'welcome',
      data: { name: 'nextjs integration test (node)' },
    })
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  }, 30_000)
})
