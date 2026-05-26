import { writeFileSync } from 'node:fs'
import { createPoliPageClient } from '@poli-page/nextjs'

const client = createPoliPageClient()
const pdf = await client.render.pdf({
  project: 'getting-started',
  template: 'welcome',
  data: { name: 'renderToFile demo' },
  version: '1.0.0',
})

const outPath = '/tmp/poli-page-demo-file.pdf'
writeFileSync(outPath, pdf)
console.log(`Wrote ${outPath} (${pdf.byteLength} bytes)`)
