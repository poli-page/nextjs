import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler<{ id: string }>(async ({ client, params }) => {
  const descriptor = await client.documents.get(params.id)
  return { kind: 'redirect' as const, url: descriptor.presignedPdfUrl }
})

export const DELETE = createPoliPageRouteHandler<{ id: string }>(async ({ client, params }) => {
  await client.documents.delete(params.id)
  return new Response(null, { status: 204 })
})
