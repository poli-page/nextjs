import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { renderToFile } from '@poli-page/sdk/node'
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

// Why: server-only route — the demo writes to a project-relative path so the
// user can `open` the PDF after clicking the button. The output directory is
// gitignored at the example-app level.
const OUTPUT_PATH = join(process.cwd(), 'output', 'welcome.pdf')

export const POST = createPoliPageRouteHandler(async ({ client }) => {
  await renderToFile(
    client,
    {
      project: 'getting-started',
      template: 'welcome',
      data: { name: 'renderToFile demo' },
      version: '1.0.0',
    },
    OUTPUT_PATH,
  )
  const { size } = await stat(OUTPUT_PATH)
  return Response.json({ path: OUTPUT_PATH, sizeBytes: size })
})
