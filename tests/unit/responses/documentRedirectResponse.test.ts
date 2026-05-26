import { describe, it, expect } from 'vitest'
import { documentRedirectResponse } from '../../../src/responses/documentRedirectResponse.js'

describe('documentRedirectResponse', () => {
  it('issues a 302 with the presigned url in Location', () => {
    const r = documentRedirectResponse('https://example.com/x.pdf')
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('https://example.com/x.pdf')
    expect(r.headers.get('cache-control')).toBe('no-store, private')
  })

  it('issues 308 when permanent:true', () => {
    const r = documentRedirectResponse('https://example.com/x.pdf', { permanent: true })
    expect(r.status).toBe(308)
    expect(r.headers.get('location')).toBe('https://example.com/x.pdf')
  })
})
