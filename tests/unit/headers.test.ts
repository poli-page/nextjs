import { describe, it, expect } from 'vitest'
import { contentDisposition, isAsciiSafe, rfc5987Encode } from '../../src/headers.js'

describe('isAsciiSafe', () => {
  it('returns true for plain ASCII', () => {
    expect(isAsciiSafe('invoice-123.pdf')).toBe(true)
  })
  it('returns false for non-ASCII', () => {
    expect(isAsciiSafe('facture-éléphant.pdf')).toBe(false)
  })
  it('returns false for control chars', () => {
    expect(isAsciiSafe('file\x07name.pdf')).toBe(false)
  })
})

describe('rfc5987Encode', () => {
  it('percent-encodes UTF-8 bytes for filename*', () => {
    expect(rfc5987Encode('café.pdf')).toBe('caf%C3%A9.pdf')
  })
  it('leaves ASCII alone', () => {
    expect(rfc5987Encode('plain.pdf')).toBe('plain.pdf')
  })
  it('extra-encodes single quote, parentheses (filename* token rules)', () => {
    expect(rfc5987Encode("o'(brien).pdf")).toBe('o%27%28brien%29.pdf')
  })
})

describe('contentDisposition', () => {
  it('returns attachment + ASCII filename when safe', () => {
    expect(contentDisposition('invoice.pdf', false))
      .toBe('attachment; filename="invoice.pdf"')
  })
  it('returns inline when inline:true', () => {
    expect(contentDisposition('invoice.pdf', true))
      .toBe('inline; filename="invoice.pdf"')
  })
  it('emits both ASCII fallback and filename* for non-ASCII', () => {
    expect(contentDisposition('café.pdf', false))
      .toBe(`attachment; filename="caf_.pdf"; filename*=UTF-8''caf%C3%A9.pdf`)
  })
  it('escapes embedded quotes in filename', () => {
    expect(contentDisposition('say "hi".pdf', false))
      .toContain('filename="say \\"hi\\".pdf"')
  })
})
