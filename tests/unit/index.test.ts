import { describe, it, expect } from 'vitest'
import * as pkg from '../../src/index.js'
import type { RenderInput } from '../../src/index.js'

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

  it('re-exports the SDK RenderInput type', () => {
    const input: RenderInput = { project: 'getting-started', template: 'welcome', data: {} }
    expect(input.template).toBe('welcome')
  })
})
