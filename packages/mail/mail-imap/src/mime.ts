/**
 * Minimal MIME handling for the mailbox seam: header unfolding, RFC 2047
 * encoded-word decoding, charset-aware body decoding, and best-effort
 * text-part selection from multipart bodies.
 * @module @deepseek-ai/dsh-mail-imap/mime
 */

/**
 * Unfold RFC 5322 headers: join continuation lines and strip the folding CRLF
 * so each logical header is one `Name: value` line.
 * @param raw - the raw header block, lines separated by CRLF or LF.
 * @returns unfolded logical header lines in order.
 */
export function unfoldHeaders(raw: string): string[] {
  const lines = raw.split(/\r?\n/)
  const unfolded: string[] = []
  for (const line of lines) {
    if (line.length === 0) continue
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.replace(/^[ \t]+/, ' ')
      continue
    }
    unfolded.push(line)
  }
  return unfolded
}

/** One decoded logical header. */
export interface DecodedHeader {
  readonly name: string
  readonly value: string
}

/** Read a header block into decoded `name`/`value` pairs (case-preserving names). */
export function parseHeaders(raw: string): DecodedHeader[] {
  return unfoldHeaders(raw).map((line) => {
    const colon = line.indexOf(':')
    if (colon === -1) return { name: line.trim(), value: '' }
    return {
      name: line.slice(0, colon).trim(),
      value: decodeEncodedWords(line.slice(colon + 1).trim()),
    }
  })
}

/** First decoded header value matching `name` case-insensitively, else undefined. */
export function headerValue(headers: readonly DecodedHeader[], name: string): string | undefined {
  const lower = name.toLowerCase()
  const found = headers.find(header => header.name.toLowerCase() === lower)
  return found?.value
}

/**
 * Decode RFC 2047 encoded words (`=?charset?B?...?=` / `=?charset?Q?...?=`) in
 * a header value. Undecodable tokens pass through unchanged; malformed
 * base64/quoted-printable payloads fall back to their raw bytes.
 */
export function decodeEncodedWords(value: string): string {
  return value.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_all, charset: string, enc: string, data: string) => {
    try {
      if (enc.toLowerCase() === 'b') {
        return new TextDecoder(charset).decode(Buffer.from(data, 'base64'))
      }
      const qp = data.replace(/_/g, ' ').replace(/=([0-9a-fA-F]{2})/g, (_m, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)))
      return new TextDecoder(charset).decode(Buffer.from(qp, 'latin1'))
    } catch {
      // Unknown charset or corrupt payload: the raw token is more faithful to
      // the sender than an empty string or a thrown error.
      return _all
    }
  })
}

/**
 * Decode one body transfer encoding into bytes. Unsupported encodings return
 * the input reinterpreted as latin1 bytes — never an exception.
 */
export function decodeTransferEncoding(text: string, encoding: string | undefined): Buffer {
  const normalized = encoding?.trim().toLowerCase() ?? ''
  switch (normalized) {
    case 'base64':
      return Buffer.from(text.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64')
    case 'quoted-printable':
      return Buffer.from(
        text.replace(/=\r?\n/g, '').replace(/=([0-9a-fA-F]{2})/g, (_m, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16))),
        'latin1',
      )
    default:
      // `7bit`, `8bit`, binary, and unknown labels: bytes as-is.
      return Buffer.from(text, 'latin1')
  }
}

/** Charset label for one Content-Type value, defaulting to us-ascii per RFC 2046. */
export function charsetOf(contentType: string | undefined): string {
  const match = /charset\s*=\s*"([^"]+)"|charset\s*=\s*([^\s;]+)/i.exec(contentType ?? '')
  const found = match?.[1] ?? match?.[2]
  return found?.replace(/^"|"$/g, '') || 'us-ascii'
}

/** Decode bytes into text using the declared charset; unknown charsets degrade to utf-8. */
export function decodeText(bytes: Buffer, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

/**
 * Split a multipart MIME body into its top-level parts. Splits on the exact
 * `--boundary` delimiters (the closing `--boundary--` included) without
 * interpreting nested multiparts: each returned part keeps its full header
 * block, so a nested multipart surfaces as one opaque leaf whose declared
 * content type names the nesting — and `pickBodyText` then falls through to
 * its raw-text fallback instead of losing the message to an empty result.
 * @param body - the raw MIME body text.
 * @returns the raw parts in server order; `[body]` when no boundary applies.
 */
export function splitMultipart(body: string, boundary: string | undefined): string[] {
  if (boundary === undefined || boundary.length === 0) return [body]
  const lines = body.split(/\r?\n/)
  const dash = `--${boundary}`
  const parts: string[] = []
  let current: string[] | undefined
  for (const line of lines) {
    if (line === dash || line.startsWith(`${dash}--`)) {
      // The closing delimiter flushes like a normal one; nothing follows it.
      if (current !== undefined) {
        parts.push(current.join('\r\n'))
        current = undefined
      }
      if (line !== dash) break
      current = []
      continue
    }
    if (current !== undefined) current.push(line)
  }
  return parts.length > 0 ? parts : [body]
}

/** One parsed leaf of a message body: its headers plus the raw payload text. */
export interface MimePart {
  /** Parsed part headers; absent when the part carries no header block. */
  readonly headers?: readonly DecodedHeader[]
  /** The part's payload exactly as received, before transfer decoding. */
  readonly text: string
}

/**
 * Parse one raw MIME part into headers plus payload, splitting at the first
 * blank line. Header values are RFC 2047-decoded; the payload stays raw for
 * transfer decoding downstream.
 */
export function parseMimePart(part: string): MimePart {
  const separator = /\r?\n\r?\n/.exec(part)
  const head = separator === null ? part : part.slice(0, separator.index)
  const payload = separator === null ? '' : part.slice(separator.index + separator[0].length)
  return { headers: parseHeaders(head), text: payload }
}

/**
 * Pick the best body text from a message's part map and decode it.
 * `text/plain` wins over `text/html`; otherwise any text part is used.
 * @param parts - content-type/encoding pairs paired with their raw section
 *   texts, in server order.
 * @returns the decoded text of the chosen part, or the empty string when no
 *   text part exists.
 */
export function pickBodyText(
  parts: ReadonlyArray<{ contentType?: string; encoding?: string; text: string }>,
): string {
  let html: { contentType?: string; encoding?: string; text: string } | undefined
  for (const part of parts) {
    const type = part.contentType?.split(';')[0]?.trim().toLowerCase() ?? ''
    if (type === 'text/plain') {
      return decodeText(decodeTransferEncoding(part.text, part.encoding), charsetOf(part.contentType))
    }
    if (type === 'text/html' && html === undefined) html = part
  }
  if (html !== undefined) {
    return stripHtml(decodeText(decodeTransferEncoding(html.text, html.encoding), charsetOf(html.contentType)))
  }
  // No recognized content-type: treat the whole fetched section as plain text.
  const first = parts[0]
  return first === undefined ? '' : decodeText(decodeTransferEncoding(first.text, first.encoding), charsetOf(first.contentType))
}

/** Reduce HTML to readable text: drop head/script/style, unwrap tags, unescape entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
