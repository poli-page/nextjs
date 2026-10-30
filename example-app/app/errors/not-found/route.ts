import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client }) => {
  await client.render.pdf({
    project: 'getting-started',
    template: 'does-not-exist',
    data: {},
  })
  return new Response('unreachable', { status: 500 })
})
