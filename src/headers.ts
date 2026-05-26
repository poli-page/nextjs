const ASCII_SAFE = /^[\x20-\x7E]+$/

export function isAsciiSafe(s: string): boolean {
  return ASCII_SAFE.test(s)
}

export function rfc5987Encode(s: string): string {
  return encodeURIComponent(s).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function contentDisposition(filename: string, inline: boolean): string {
  const disposition = inline ? 'inline' : 'attachment'
  if (isAsciiSafe(filename)) {
    return `${disposition}; filename="${escapeQuotes(filename)}"`
  }
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_')
  const encoded = rfc5987Encode(filename)
  return `${disposition}; filename="${escapeQuotes(asciiFallback)}"; filename*=UTF-8''${encoded}`
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"')
}
