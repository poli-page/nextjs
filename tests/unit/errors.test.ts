import { describe, it, expect } from 'vitest'
import { PoliPageError } from '@poli-page/sdk'
import { poliPageErrorToResponse } from '../../src/errors.js'

describe('poliPageErrorToResponse', () => {
  it('maps 4xx to same status', async () => {
    const err = new PoliPageError('Bad version', 'INVALID_VERSION_FORMAT', 400, 'req_1')
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(400)
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await r.json()).toEqual({
      code: 'INVALID_VERSION_FORMAT', message: 'Bad version', requestId: 'req_1',
    })
  })

  it('maps 5xx to same status', async () => {
    const err = new PoliPageError('boom', 'INTERNAL_ERROR', 503)
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(503)
    expect(await r.json()).toMatchObject({ code: 'INTERNAL_ERROR', message: 'boom' })
  })

  it('maps network errors (no status) to 502, passing the SDK code through', async () => {
    const err = new PoliPageError('connection refused', 'network_error')
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(502)
    const body = await r.json()
    expect(body.code).toBe('network_error')
    expect(body.requestId).toBeNull()
  })

  it('maps timeouts (no status) to 502', async () => {
    const err = new PoliPageError('timed out', 'timeout')
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(502)
    expect(await r.json()).toMatchObject({ code: 'timeout' })
  })

  it('sets cache-control no-store on error responses', () => {
    const r = poliPageErrorToResponse(new PoliPageError('x', 'INVALID_VERSION_FORMAT', 400))
    expect(r.headers.get('cache-control')).toBe('no-store, private')
  })

  it('falls back to 502 for unexpected status values', async () => {
    const err = new PoliPageError('odd', 'INTERNAL_ERROR', 200)
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(502)
  })
})
