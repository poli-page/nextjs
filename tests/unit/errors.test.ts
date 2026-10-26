import { describe, it, expect } from 'vitest'
import { PoliPageError } from '@poli-page/sdk'
import { poliPageErrorToResponse } from '../../src/errors.js'

describe('poliPageErrorToResponse', () => {
  it('maps 4xx to same status with canonical body', async () => {
    const err = new PoliPageError('Template not found', 'TEMPLATE_NOT_FOUND', 404, 'req_1')
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(404)
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await r.json()).toEqual({
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Template not found',
      status: 404,
      requestId: 'req_1',
    })
  })

  it('maps 5xx to same status', async () => {
    const err = new PoliPageError('boom', 'INTERNAL_ERROR', 503)
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(503)
    expect(await r.json()).toMatchObject({ code: 'INTERNAL_ERROR', message: 'boom', status: 503 })
  })

  it('maps network errors to 503, passing the SDK code through', async () => {
    const err = new PoliPageError('connection refused', 'network_error')
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(503)
    const body = await r.json()
    expect(body.code).toBe('network_error')
    expect(body.status).toBe(503)
    expect(body.requestId).toBeNull()
  })

  it('maps timeouts to 504', async () => {
    const err = new PoliPageError('timed out', 'timeout')
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(504)
    expect(await r.json()).toMatchObject({ code: 'timeout', status: 504 })
  })

  it('sets cache-control no-store on error responses', () => {
    const r = poliPageErrorToResponse(new PoliPageError('x', 'VALIDATION_ERROR', 400))
    expect(r.headers.get('cache-control')).toBe('no-store, private')
  })
})
