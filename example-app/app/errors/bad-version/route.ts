import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client }) => {
  await client.render.pdf({
    project: 'getting-started',
    template: 'welcome',
    data: {},
    version: 'not-a-version',
  })
  return new Response('unreachable', { status: 500 })
})
