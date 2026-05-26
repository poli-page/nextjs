import { describe, it, expect } from 'vitest'
import * as pkg from '../../src/index.js'

describe('public exports', () => {
  it('exposes the documented surface and nothing else', () => {
    expect(Object.keys(pkg).sort()).toEqual([
      'createPoliPageClient',
      'createPoliPageRouteHandler',
      'documentRedirectResponse',
      'pdfResponse',
      'previewResponse',
    ])
  })
})
