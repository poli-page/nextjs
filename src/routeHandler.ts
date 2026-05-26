import { PoliPageError } from '@poli-page/sdk'
import type { PoliPage } from '@poli-page/sdk'
import { createPoliPageClient } from './client.js'
import { pdfResponse } from './responses/pdfResponse.js'
import type { PdfResponseOptions } from './responses/pdfResponse.js'
import { previewResponse } from './responses/previewResponse.js'
import { documentRedirectResponse } from './responses/documentRedirectResponse.js'
import type { DocumentRedirectOptions } from './responses/documentRedirectResponse.js'
import { poliPageErrorToResponse } from './errors.js'

export interface RouteHandlerContext<TParams> {
  req: Request
  params: TParams
  client: PoliPage
}

export type RouteHandlerResult =
  | Uint8Array
  | ArrayBuffer
  | ReadableStream<Uint8Array>
  | { kind: 'pdf'; bytes: Uint8Array | ArrayBuffer; filename?: string; inline?: boolean }
  | { kind: 'stream'; stream: ReadableStream<Uint8Array>; filename?: string; inline?: boolean }
  | { kind: 'preview'; html: string }
  | { kind: 'redirect'; url: string; permanent?: boolean }
  | Response

export interface RouteHandlerOptions<TParams = Record<string, string>> {
  client?: PoliPage
  onError?: (err: unknown, ctx: RouteHandlerContext<TParams>) => Response | void
}

export function createPoliPageRouteHandler<TParams = Record<string, string>>(
  handler: (ctx: RouteHandlerContext<TParams>) => Promise<RouteHandlerResult>,
  options: RouteHandlerOptions<TParams> = {},
): (req: Request, ctx: { params: Promise<TParams> }) => Promise<Response> {
  return async (req, ctx) => {
    const params = await ctx.params
    const client = options.client ?? createPoliPageClient()
    const routeCtx: RouteHandlerContext<TParams> = { req, params, client }
    try {
      const result = await handler(routeCtx)
      return materialise(result)
    } catch (err) {
      if (options.onError !== undefined) {
        const custom = options.onError(err, routeCtx)
        if (custom !== undefined) return custom
      }
      if (err instanceof PoliPageError) {
        return poliPageErrorToResponse(err)
      }
      throw err
    }
  }
}

function materialise(result: RouteHandlerResult): Response {
  if (result instanceof Response) return result
  if (result instanceof Uint8Array || result instanceof ArrayBuffer) return pdfResponse(result)
  if (result instanceof ReadableStream) return pdfResponse(result)
  switch (result.kind) {
    case 'pdf': {
      const opts: PdfResponseOptions = {}
      if (result.filename !== undefined) opts.filename = result.filename
      if (result.inline !== undefined) opts.inline = result.inline
      return pdfResponse(result.bytes, opts)
    }
    case 'stream': {
      const opts: PdfResponseOptions = {}
      if (result.filename !== undefined) opts.filename = result.filename
      if (result.inline !== undefined) opts.inline = result.inline
      return pdfResponse(result.stream, opts)
    }
    case 'preview':
      return previewResponse(result.html)
    case 'redirect': {
      const opts: DocumentRedirectOptions = {}
      if (result.permanent !== undefined) opts.permanent = result.permanent
      return documentRedirectResponse(result.url, opts)
    }
  }
}
