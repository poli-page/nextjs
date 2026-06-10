import { describe, it, expect, vi } from 'vitest'
import {
  createPoliPageClient,
  createPoliPageRouteHandler,
  pdfResponse,
  previewResponse,
  documentRedirectResponse,
} from '../../src/index.js'
import type { PoliPage } from '@poli-page/sdk'

describe('edge-runtime compatibility', () => {
  it('imports all public exports without Node-only API errors', () => {
    expect(typeof createPoliPageClient).toBe('function')
    expect(typeof createPoliPageRouteHandler).toBe('function')
    expect(typeof pdfResponse).toBe('function')
    expect(typeof previewResponse).toBe('function')
    expect(typeof documentRedirectResponse).toBe('function')
  })

  it('runs pdfResponse with a Uint8Array body', async () => {
    const r = pdfResponse(new TextEncoder().encode('%PDF-1.4\n'))
    expect(r.headers.get('content-type')).toBe('application/pdf')
    const buf = new Uint8Array(await r.arrayBuffer())
    expect(buf[0]).toBe(0x25)
  })

  it('runs previewResponse with HTML', async () => {
    const r = previewResponse('<h1>edge</h1>')
    expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await r.text()).toBe('<h1>edge</h1>')
  })

  it('runs documentRedirectResponse', () => {
    const r = documentRedirectResponse('https://example.com/x.pdf')
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('https://example.com/x.pdf')
  })

  it('runs the route handler factory with a mocked client', async () => {
    const renderPdf = vi.fn(async () => new TextEncoder().encode('%PDF-1.4\n'))
    const mockClient = { render: { pdf: renderPdf } } as unknown as PoliPage
    const handler = createPoliPageRouteHandler(
      async ({ client }) => {
        const bytes = await client.render.pdf({
          project: 'getting-started',
          template: 'welcome',
          data: {},
          version: '1.0.0',
        })
        return bytes as Uint8Array
      },
      { client: mockClient },
    )
    const r = await handler(new Request('http://x'), { params: Promise.resolve({}) })
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(renderPdf).toHaveBeenCalledOnce()
  })

  it('actually runs under the edge-runtime environment', () => {
    expect((globalThis as Record<string, unknown>).EdgeRuntime).toBeDefined()
  })
})

const apiKey = process.env.POLI_PAGE_API_KEY ?? ''
const skip = !apiKey.startsWith('pp_test_')

describe.skipIf(skip)('render welcome against live API (edge runtime)', () => {
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
      data: { name: 'nextjs integration test (edge)' },
      version: '1.0.0',
    })
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  }, 30_000)
})
