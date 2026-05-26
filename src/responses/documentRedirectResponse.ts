export interface DocumentRedirectOptions {
  permanent?: boolean
}

export function documentRedirectResponse(
  presignedUrl: string,
  options: DocumentRedirectOptions = {},
): Response {
  return new Response(null, {
    status: options.permanent === true ? 308 : 302,
    headers: {
      Location: presignedUrl,
      'Cache-Control': 'no-store, private',
    },
  })
}
