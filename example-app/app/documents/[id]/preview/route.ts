import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler<{ id: string }>(async ({ client, params }) => {
  const result = await client.documents.preview(params.id)
  return { kind: 'preview' as const, html: result.html }
})
