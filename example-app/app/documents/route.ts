import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const POST = createPoliPageRouteHandler(async ({ client }) => {
  const descriptor = await client.render.document({
    project: 'getting-started',
    template: 'welcome',
    data: { name: 'Stored doc' },
  })
  return Response.json(descriptor)
})
