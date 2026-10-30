import type { PoliPageError } from '@poli-page/sdk'

/**
 * Answers a `PoliPageError` with the SDK's `toPayload()` as the JSON body:
 * `{ code, message, status, requestId }`. The HTTP status is the payload's
 * `status` (the API status, 503 for `network_error`, 504 for `timeout`), or
 * 500 when the error has none; the body keeps `status: null` in that case.
 */
export function poliPageErrorToResponse(err: PoliPageError): Response {
  const payload = err.toPayload()
  return new Response(JSON.stringify(payload), {
    status: payload.status ?? 500,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
    },
  })
}
