import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client }) => ({
  kind: 'pdf' as const,
  bytes: await client.render.pdf({
    project: 'getting-started',
    template: 'welcome',
    data: { name: 'World' },
    version: '1.0.0',
  }),
  filename: 'welcome.pdf',
  inline: true,
}))
