import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client, req }) => {
  const inlineHtml = new URL(req.url).searchParams.get('html')
  const result = inlineHtml !== null
    ? await client.render.preview({ template: inlineHtml, data: {} })
    : await client.render.preview({
        project: 'getting-started',
        template: 'welcome',
        data: { name: 'World' },
        version: '1.0.0',
      })
  return { kind: 'preview' as const, html: result.html }
})
