import { describe, it, expect } from 'vitest'
import { PoliPageError } from '@poli-page/sdk'
import { poliPageErrorToResponse } from '../../src/errors.js'

describe('poliPageErrorToResponse', () => {
  it('answers an API error with its status and the toPayload() body', async () => {
    const err = new PoliPageError('Template not found', 'TEMPLATE_NOT_FOUND', 404, 'req_1')
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(404)
    expect(r.headers.get('content-type')).toBe('application/json')
    const body: unknown = await r.json()
    expect(body).toStrictEqual({
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Template not found',
      status: 404,
      requestId: 'req_1',
    })
    expect(body).toStrictEqual(err.toPayload())
  })

  it('answers a 5xx API error with the same status', async () => {
    const r = poliPageErrorToResponse(new PoliPageError('boom', 'INTERNAL_ERROR', 500, 'req_2'))
    expect(r.status).toBe(500)
    expect(await r.json()).toStrictEqual({
      code: 'INTERNAL_ERROR',
      message: 'boom',
      status: 500,
      requestId: 'req_2',
    })
  })

  it('answers network_error with 503, as toPayload() maps it', async () => {
    const r = poliPageErrorToResponse(new PoliPageError('Network request failed', 'network_error'))
    expect(r.status).toBe(503)
    expect(await r.json()).toStrictEqual({
      code: 'network_error',
      message: 'Network request failed',
      status: 503,
      requestId: null,
    })
  })

  it('answers timeout with 504, as toPayload() maps it', async () => {
    const r = poliPageErrorToResponse(new PoliPageError('Request timed out after 60000ms', 'timeout'))
    expect(r.status).toBe(504)
    expect(await r.json()).toStrictEqual({
      code: 'timeout',
      message: 'Request timed out after 60000ms',
      status: 504,
      requestId: null,
    })
  })

  it('answers 500 for an SDK error with no status, and keeps status null in the body', async () => {
    const r = poliPageErrorToResponse(new PoliPageError('apiKey is required', 'invalid_options'))
    expect(r.status).toBe(500)
    expect(await r.json()).toStrictEqual({
      code: 'invalid_options',
      message: 'apiKey is required',
      status: null,
      requestId: null,
    })
  })

  it('sets cache-control no-store on error responses', () => {
    const r = poliPageErrorToResponse(new PoliPageError('x', 'VALIDATION_ERROR', 400))
    expect(r.headers.get('cache-control')).toBe('no-store, private')
  })
})
