import type { PoliPageError } from '@poli-page/sdk'

export function poliPageErrorToResponse(err: PoliPageError): Response {
  const payload = err.toPayload()
  const status = payload.status ?? 500
  const body = {
    code: payload.code,
    message: payload.message,
    status,
    requestId: payload.requestId,
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
    },
  })
}
