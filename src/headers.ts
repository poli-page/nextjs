const ASCII_SAFE = /^[\x20-\x7E]+$/

export function isAsciiSafe(s: string): boolean {
  return ASCII_SAFE.test(s)
}

export function rfc5987Encode(s: string): string {
  return encodeURIComponent(s).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

// C0 controls (incl. TAB, CR, LF), DEL and C1 controls. None of them belong in a
// filename, and CR/LF would split the header (response splitting).
const CONTROL_CHARS = /[\x00-\x1F\x7F-\x9F]/g

/**
 * Builds a Content-Disposition value per RFC 6266 / RFC 8187 (ex-5987).
 *
 * Control characters are stripped. ASCII filenames use a quoted-string
 * `filename="..."` with `\` and `"` escaped as quoted-pairs. Non-ASCII filenames
 * use the dual notation: an escaped ASCII `filename="..."` fallback for legacy
 * clients plus a UTF-8 percent-encoded `filename*=UTF-8''...`.
 */
export function contentDisposition(filename: string, inline: boolean): string {
  const disposition = inline ? 'inline' : 'attachment'
  const clean = filename.replace(CONTROL_CHARS, '')
  if (isAsciiSafe(clean)) {
    return `${disposition}; filename="${quotedStringContent(clean)}"`
  }
  const asciiFallback = clean.replace(/[^\x20-\x7E]/g, '_')
  const encoded = rfc5987Encode(clean)
  return `${disposition}; filename="${quotedStringContent(asciiFallback)}"; filename*=UTF-8''${encoded}`
}

/** Escapes `\` and `"` as quoted-pairs (RFC 9110 §5.6.4). */
function quotedStringContent(s: string): string {
  return s.replace(/[\\"]/g, '\\$&')
}
