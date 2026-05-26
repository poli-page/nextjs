import { describe, it, expect } from 'vitest'
import { pdfResponse } from '../../../src/responses/pdfResponse.js'

const pdfBytes = new TextEncoder().encode('%PDF-1.4\nstub\n')

describe('pdfResponse', () => {
  it('sets application/pdf with attachment by default', async () => {
    const r = pdfResponse(pdfBytes, { filename: 'invoice.pdf' })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="invoice.pdf"')
    expect(r.headers.get('cache-control')).toBe('no-store, private')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    const body = new Uint8Array(await r.arrayBuffer())
    expect(body).toEqual(pdfBytes)
  })

  it('uses inline disposition when inline:true', () => {
    const r = pdfResponse(pdfBytes, { filename: 'invoice.pdf', inline: true })
    expect(r.headers.get('content-disposition')).toBe('inline; filename="invoice.pdf"')
  })

  it('RFC 5987-encodes non-ASCII filenames', () => {
    const r = pdfResponse(pdfBytes, { filename: 'café.pdf' })
    expect(r.headers.get('content-disposition'))
      .toBe(`attachment; filename="caf_.pdf"; filename*=UTF-8''caf%C3%A9.pdf`)
  })

  it('accepts a ReadableStream body', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(pdfBytes); c.close() },
    })
    const r = pdfResponse(stream, { filename: 'x.pdf' })
    const body = new Uint8Array(await r.arrayBuffer())
    expect(body).toEqual(pdfBytes)
  })

  it('honors cacheControl override', () => {
    const r = pdfResponse(pdfBytes, { filename: 'x.pdf', cacheControl: 'public, max-age=60' })
    expect(r.headers.get('cache-control')).toBe('public, max-age=60')
  })

  it('omits filename when none provided', () => {
    const r = pdfResponse(pdfBytes)
    expect(r.headers.get('content-disposition')).toBe('attachment')
  })

  it('uses inline disposition without filename', () => {
    const r = pdfResponse(pdfBytes, { inline: true })
    expect(r.headers.get('content-disposition')).toBe('inline')
  })
})
