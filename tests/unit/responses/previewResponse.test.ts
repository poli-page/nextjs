import { describe, it, expect } from 'vitest'
import { previewResponse } from '../../../src/responses/previewResponse.js'

describe('previewResponse', () => {
  it('returns text/html with no-store cache by default', async () => {
    const r = previewResponse('<h1>Hi</h1>')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(r.headers.get('cache-control')).toBe('no-store, private')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await r.text()).toBe('<h1>Hi</h1>')
  })

  it('honors cacheControl override', () => {
    const r = previewResponse('<h1>Hi</h1>', { cacheControl: 'public, max-age=300' })
    expect(r.headers.get('cache-control')).toBe('public, max-age=300')
  })
})
