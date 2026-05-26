import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PoliPageError } from '@poli-page/sdk'
import type { PoliPage } from '@poli-page/sdk'
import { createPoliPageRouteHandler } from '../../src/routeHandler.js'
import { __resetMemoForTests } from '../../src/client.js'

const stubClient = (): PoliPage =>
  ({ render: { pdf: vi.fn(), preview: vi.fn(), pdfStream: vi.fn() } } as unknown as PoliPage)

const pdfBytes = new TextEncoder().encode('%PDF-1.4\nstub\n')
const req = new Request('http://localhost/test')
const ctx = (): { params: Promise<{ id: string }> } => ({ params: Promise.resolve({ id: '42' }) })

describe('createPoliPageRouteHandler', () => {
  const originalEnv = { ...process.env }
  beforeEach(() => {
    __resetMemoForTests()
    delete process.env.POLI_PAGE_API_KEY
  })
  afterEach(() => { process.env = { ...originalEnv } })

  it('wraps a bare Uint8Array return value as a PDF response', async () => {
    const handler = createPoliPageRouteHandler(async () => pdfBytes, { client: stubClient() })
    const r = await handler(req, ctx())
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(pdfBytes)
  })

  it('wraps a bare ReadableStream return value as a PDF response', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(pdfBytes); c.close() },
    })
    const handler = createPoliPageRouteHandler(async () => stream, { client: stubClient() })
    const r = await handler(req, ctx())
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(pdfBytes)
  })

  it('handles { kind: "pdf", bytes, filename }', async () => {
    const handler = createPoliPageRouteHandler(
      async () => ({ kind: 'pdf' as const, bytes: pdfBytes, filename: 'invoice-42.pdf' }),
      { client: stubClient() },
    )
    const r = await handler(req, ctx())
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="invoice-42.pdf"')
  })

  it('handles { kind: "pdf" } with inline:true', async () => {
    const handler = createPoliPageRouteHandler(
      async () => ({ kind: 'pdf' as const, bytes: pdfBytes, filename: 'doc.pdf', inline: true }),
      { client: stubClient() },
    )
    const r = await handler(req, ctx())
    expect(r.headers.get('content-disposition')).toBe('inline; filename="doc.pdf"')
  })

  it('handles { kind: "stream" }', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(pdfBytes); c.close() },
    })
    const handler = createPoliPageRouteHandler(
      async () => ({ kind: 'stream' as const, stream, filename: 's.pdf' }),
      { client: stubClient() },
    )
    const r = await handler(req, ctx())
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="s.pdf"')
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(pdfBytes)
  })

  it('handles { kind: "preview", html }', async () => {
    const handler = createPoliPageRouteHandler(
      async () => ({ kind: 'preview' as const, html: '<h1>Hi</h1>' }),
      { client: stubClient() },
    )
    const r = await handler(req, ctx())
    expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await r.text()).toBe('<h1>Hi</h1>')
  })

  it('handles { kind: "redirect", url }', async () => {
    const handler = createPoliPageRouteHandler(
      async () => ({ kind: 'redirect' as const, url: 'https://example.com/x.pdf' }),
      { client: stubClient() },
    )
    const r = await handler(req, ctx())
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('https://example.com/x.pdf')
  })

  it('handles { kind: "redirect", permanent: true } with 308', async () => {
    const handler = createPoliPageRouteHandler(
      async () => ({ kind: 'redirect' as const, url: 'https://example.com/x.pdf', permanent: true }),
      { client: stubClient() },
    )
    const r = await handler(req, ctx())
    expect(r.status).toBe(308)
  })

  it('returns a user Response as-is', async () => {
    const userResponse = new Response('hello', { status: 418 })
    const handler = createPoliPageRouteHandler(async () => userResponse, { client: stubClient() })
    const r = await handler(req, ctx())
    expect(r).toBe(userResponse)
  })

  it('maps PoliPageError to typed JSON response', async () => {
    const handler = createPoliPageRouteHandler(
      async () => { throw new PoliPageError('bad', 'INVALID_VERSION_FORMAT', 400) },
      { client: stubClient() },
    )
    const r = await handler(req, ctx())
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ code: 'INVALID_VERSION_FORMAT' })
  })

  it('rethrows non-PoliPageError', async () => {
    const handler = createPoliPageRouteHandler(
      async () => { throw new Error('boom') },
      { client: stubClient() },
    )
    await expect(handler(req, ctx())).rejects.toThrowError('boom')
  })

  it('passes resolved params + req + client to handler', async () => {
    const client = stubClient()
    const inner = vi.fn<(c: { req: Request; params: { id: string }; client: PoliPage }) => Promise<Uint8Array>>(
      async () => pdfBytes,
    )
    const handler = createPoliPageRouteHandler<{ id: string }>(inner, { client })
    await handler(req, ctx())
    expect(inner).toHaveBeenCalledTimes(1)
    const arg = inner.mock.calls[0]?.[0]
    expect(arg?.req).toBe(req)
    expect(arg?.params).toEqual({ id: '42' })
    expect(arg?.client).toBe(client)
  })

  it('uses the default client when none is passed', async () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_default'
    let captured: PoliPage | undefined
    const handler = createPoliPageRouteHandler(async ({ client }) => { captured = client; return pdfBytes })
    await handler(req, ctx())
    expect(captured).toBeDefined()
  })

  it('invokes options.onError and uses its Response when returned', async () => {
    const onError = vi.fn(() => new Response('custom', { status: 503 }))
    const handler = createPoliPageRouteHandler(
      async () => { throw new Error('whatever') },
      { client: stubClient(), onError },
    )
    const r = await handler(req, ctx())
    expect(r.status).toBe(503)
    expect(await r.text()).toBe('custom')
    expect(onError).toHaveBeenCalled()
  })

  it('falls through to default mapping when onError returns void on a PoliPageError', async () => {
    const onError = vi.fn(() => undefined)
    const handler = createPoliPageRouteHandler(
      async () => { throw new PoliPageError('bad', 'INVALID_VERSION_FORMAT', 400) },
      { client: stubClient(), onError },
    )
    const r = await handler(req, ctx())
    expect(r.status).toBe(400)
    expect(onError).toHaveBeenCalled()
  })
})
