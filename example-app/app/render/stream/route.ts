import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client }) => ({
  kind: 'stream' as const,
  stream: await client.render.pdfStream({
    project: 'getting-started',
    template: 'welcome',
    data: { name: 'World' },
  }),
  filename: 'welcome.pdf',
  inline: true,
}))
