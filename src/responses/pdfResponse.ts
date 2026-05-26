import { contentDisposition } from '../headers.js'

export interface PdfResponseOptions {
  filename?: string
  inline?: boolean
  cacheControl?: string
}

export function pdfResponse(
  body: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>,
  options: PdfResponseOptions = {},
): Response {
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Cache-Control': options.cacheControl ?? 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
  })
  if (options.filename !== undefined) {
    headers.set('Content-Disposition', contentDisposition(options.filename, options.inline ?? false))
  } else {
    headers.set('Content-Disposition', (options.inline ?? false) ? 'inline' : 'attachment')
  }
  return new Response(body as BodyInit, { status: 200, headers })
}
