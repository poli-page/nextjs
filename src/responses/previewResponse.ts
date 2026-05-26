export interface PreviewResponseOptions {
  cacheControl?: string
}

export function previewResponse(html: string, options: PreviewResponseOptions = {}): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': options.cacheControl ?? 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
