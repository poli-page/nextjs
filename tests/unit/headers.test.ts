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

  it.each([
    ['double-quote-is-escaped', 'say "hi".pdf', 'attachment; filename="say \\"hi\\".pdf"'],
    ['backslash-is-escaped', 'a\\b.pdf', 'attachment; filename="a\\\\b.pdf"'],
    [
      'crlf-is-stripped',
      'evil.pdf\r\nSet-Cookie: sid=1',
      'attachment; filename="evil.pdfSet-Cookie: sid=1"',
    ],
    ['control-chars-are-stripped', 'tab\there\x00\x1f\x7f.pdf', 'attachment; filename="tabhere.pdf"'],
    [
      'parameter-injection-stays-inside-the-quoted-string',
      'x.pdf"; filename="pwn.exe',
      'attachment; filename="x.pdf\\"; filename=\\"pwn.exe"',
    ],
    [
      'non-ascii-uses-rfc5987-dual-notation',
      'résumé François.pdf',
      `attachment; filename="r_sum_ Fran_ois.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20Fran%C3%A7ois.pdf`,
    ],
    [
      'non-ascii-fallback-is-escaped',
      'résumé "final"\\v2.pdf',
      `attachment; filename="r_sum_ \\"final\\"\\\\v2.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22final%22%5Cv2.pdf`,
    ],
    [
      'non-ascii-control-chars-are-stripped-from-both-forms',
      'résumé\r\n\x85.pdf',
      `attachment; filename="r_sum_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`,
    ],
  ])('is RFC 6266 safe: %s', (_id, filename, expected) => {
    expect(contentDisposition(filename, false)).toBe(expected)
  })
  it('escapes and strips the inline disposition too', () => {
    expect(contentDisposition('q"\r\n.pdf', true)).toBe('inline; filename="q\\".pdf"')
  })
})
