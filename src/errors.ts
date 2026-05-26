import type { PoliPageError } from '@poli-page/sdk'

export function poliPageErrorToResponse(err: PoliPageError): Response {
  const status =
    typeof err.status === 'number' && err.status >= 400 && err.status < 600
      ? err.status
      : 502
  const body = {
    code: err.code,
    message: err.message,
    requestId: err.requestId ?? null,
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
    },
  })
}
