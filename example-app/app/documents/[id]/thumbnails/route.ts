import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler<{ id: string }>(async ({ client, params, req }) => {
  const width = Number(new URL(req.url).searchParams.get('width') ?? '400')
  const result = await client.documents.thumbnails(params.id, { width })
  return Response.json(result)
})
