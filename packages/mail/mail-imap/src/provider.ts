/**
 * IMAP `MailListProvider` / `MailReadProvider` over a single account: one
 * short-lived IMAP connection per operation (SELECT the mailbox, run one
 * command, close), credentials resolved per call through the credential seam.
 * The provider owns protocol and decoding; presentation stays with
 * `dsh-tool-mail`.
 * @module @deepseek-ai/dsh-mail-imap/provider
 */

import { MailError } from '@deepseek-ai/dsh-mail'
import type { MailListProvider, MailListRequest, MailListResult, MailMessageSummary, MailReadProvider, MailReadRequest, MailReadResult } from '@deepseek-ai/dsh-mail'
import { ImapClient } from './client.ts'
import type { FetchedMessage, ImapConnectionOptions } from './client.ts'
import { headerValue, parseHeaders, parseMimePart, pickBodyText, splitMultipart } from './mime.ts'

/** Resolved provider limits (the plugin's schemastery Config supplies defaults). */
export interface ImapProviderOptions {
  /** IMAP server host. */
  readonly host: string
  /** IMAP server port. */
  readonly port: number
  /** Implicit TLS on connect; off means plaintext IMAP. */
  readonly secure: boolean
  /** Login user; usually the full mailbox address. */
  readonly user?: string
  /** Credential reference carrying the login password. */
  readonly passwordEnv: string
  /** Resolve the current password for one operation. */
  readonly resolvePassword: () => Promise<string | undefined>
  /** Mailbox to SELECT before listing or reading. */
  readonly mailbox: string
  /**
   * How many newest messages one list examines when matching `sinceHours`.
   * Bounds the FETCH fan-out for a busy mailbox.
   */
  readonly maxScan: number
  /** Per-read character cap on decoded body text. */
  readonly maxBodyChars: number
  /** Per-operation connect+command timeout in milliseconds. */
  readonly timeoutMs: number
  /**
   * When set with `sinceHours`, only messages newer than that many hours are
   * listed; undefined lists the newest messages unconditionally.
   */
  readonly sinceHours?: number
}

/** Stable id this provider registers under. */
export const IMAP_LIST_PROVIDER_ID = 'imap'
/** Read capability id; deliberately equal to the list id — one backend serves both. */
export const IMAP_READ_PROVIDER_ID = 'imap'

/**
 * The IMAP provider. `available()` reflects whether the configured coordinates
 * are complete — a cheap local check with no network activity and no secret
 * resolution; every network action happens inside `list`/`read`.
 */
export class ImapMailProvider implements MailListProvider, MailReadProvider {
  readonly id = IMAP_LIST_PROVIDER_ID

  constructor(private readonly resolveOptions: () => ImapProviderOptions) {}

  /** Usable exactly when the options resolve to complete connection coordinates. */
  available(): boolean {
    const options = this.resolveOptions()
    return options.host.length > 0 && options.port > 0 && options.passwordEnv.length > 0 && typeof options.resolvePassword === 'function'
  }

  async list(request: MailListRequest, signal?: AbortSignal): Promise<MailListResult> {
    const options = this.resolveOptions()
    return await withTimeout(async (abort) => {
      const client = await this.connect(options)
      try {
        const selected = await client.command(`SELECT ${quoteMailbox(options.mailbox)}`, { ...(signal !== undefined ? { signal } : {}) })
        const exists = mailboxExists(selected.untagged)
        if (exists === undefined || exists === 0) {
          return { messages: [], truncated: false }
        }
        // Newest last in IMAP sequence numbers; scan the tail window
        // newest-first so the cap keeps the newest matches, not the oldest.
        const window = Math.min(exists, Math.max(options.maxScan, request.limit))
        const first = Math.max(1, exists - window + 1)
        const fetch = await client.command(
          `FETCH ${first}:${exists} (UID INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`,
          { signal: abort, fetchSections: 1 },
        )
        const cutoff = cutoffDate(options.sinceHours)
        const matched = fetch.fetched
          .map(message => summarizeMessage(message))
          .filter((summary): summary is MailMessageSummary => summary !== undefined)
          .filter(summary => summary.date === undefined || cutoff === undefined || summary.date >= cutoff)
          .reverse()
        const messages = matched.slice(0, request.limit)
        // The mailbox holds more messages than this listing returned whenever
        // the cap, the scan window, or a partial FETCH left mail unlisted.
        const truncated = exists > messages.length
        return { messages, truncated }
      } finally {
        client.close()
      }
    }, options.timeoutMs, signal)
  }

  async read(request: MailReadRequest, signal?: AbortSignal): Promise<MailReadResult> {
    const options = this.resolveOptions()
    return await withTimeout(async (abort) => {
      const uid = parseUid(request.uid)
      const client = await this.connect(options)
      try {
        await client.command(`SELECT ${quoteMailbox(options.mailbox)}`, { signal: abort })
        const fetch = await client.command(
          `UID FETCH ${uid} (UID BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)] BODY.PEEK[TEXT])`,
          { signal: abort, fetchSections: 2 },
        )
        const message = fetch.fetched[0]
        if (message === undefined) {
          throw new MailError(`no mail message carries id "${request.uid}"`, 'MAIL_UNKNOWN_MESSAGE')
        }
        const headers = parseHeaders(decodeLatin1(message.headerBytes))
        const full = decodeMessageText(headers, message.bodyBytes)
        const bounded = full.slice(0, options.maxBodyChars)
        return {
          uid: message.uid,
          subject: headerValue(headers, 'subject') ?? '',
          from: headerValue(headers, 'from') ?? '',
          text: bounded,
          truncated: full.length > bounded.length,
        }
      } finally {
        client.close()
      }
    }, options.timeoutMs, signal)
  }

  /** Open one connection, log in, and hand back the command-capable client. */
  private async connect(options: ImapProviderOptions): Promise<ImapClient> {
    const password = await options.resolvePassword()
    if (password === undefined || password.length === 0) {
      throw new MailError(`credential "${options.passwordEnv}" is not resolvable for IMAP login`, 'MAIL_CREDENTIAL_MISSING')
    }
    const connection: ImapConnectionOptions = {
      host: options.host,
      port: options.port,
      secure: options.secure,
      user: options.user ?? options.host,
      password,
    }
    const client = new ImapClient(connection)
    try {
      await client.command(`LOGIN ${quoteString(connection.user)} ${quoteString(connection.password)}`)
      return client
    } catch (error: unknown) {
      client.close()
      throw error
    }
  }
}

/**
 * Bound one provider operation wall-clock: the caller's signal plus an
 * internal timer feed one abort controller, so a silent server cannot hold a
 * tool call open past its budget.
 */
function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  const onOuterAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onOuterAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return operation(controller.signal).finally(() => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onOuterAbort)
  })
}

/** Parse a decimal UID, rejecting anything else as an unusable message id. */
function parseUid(uid: string): string {
  if (!/^[1-9][0-9]*$/.test(uid)) {
    throw new MailError(`mail message id "${uid}" is not a usable IMAP UID`, 'MAIL_UNKNOWN_MESSAGE')
  }
  return uid
}

/** Decode raw section bytes for header parsing (headers stay ASCII/latin1-safe). */
function decodeLatin1(bytes: Buffer): string {
  return bytes.toString('latin1')
}

/**
 * Decode a fetched BODY[TEXT] into readable text. A multipart body splits on
 * the declared boundary and each parsed leaf lets {@link pickBodyText} choose
 * and decode the best text one; a singlepart body has no part headers, so its
 * content type and transfer encoding ride the message headers instead.
 */
function decodeMessageText(headers: readonly ReturnType<typeof parseHeaders>[number][], bodyBytes: Buffer): string {
  const contentType = headerValue(headers, 'content-type')
  if (contentType !== undefined && /multipart/i.test(contentType)) {
    const boundary = /boundary\s*=\s*(?:"([^"]+)"|([^\s;]+))/i.exec(contentType)
    const parts = splitMultipart(decodeLatin1(bodyBytes), boundary?.[1] ?? boundary?.[2])
      .map(part => parseMimePart(part))
      .map((part) => {
        const contentType = part.headers === undefined ? undefined : headerValue(part.headers, 'content-type')
        const encoding = part.headers === undefined ? undefined : headerValue(part.headers, 'content-transfer-encoding')
        return {
          ...(contentType !== undefined ? { contentType } : {}),
          ...(encoding !== undefined ? { encoding } : {}),
          text: part.text,
        }
      })
    return pickBodyText(parts)
  }
  const transferEncoding = headerValue(headers, 'content-transfer-encoding')
  return pickBodyText([{
    ...contentType !== undefined ? { contentType } : {},
    ...transferEncoding !== undefined ? { encoding: transferEncoding } : {},
    text: decodeLatin1(bodyBytes),
  }])
}

/** Summarize one fetched message header block, or undefined without a UID. */
function summarizeMessage(message: FetchedMessage): MailMessageSummary | undefined {
  if (!/^[1-9][0-9]*$/.test(message.uid)) return undefined
  const headers = parseHeaders(decodeLatin1(message.headerBytes))
  const date = headerValue(headers, 'date')
  const normalized = date === undefined ? undefined : normalizeDate(date)
  return {
    uid: message.uid,
    from: headerValue(headers, 'from') ?? '',
    subject: headerValue(headers, 'subject') ?? '',
    ...normalized !== undefined ? { date: normalized } : {},
  }
}

/** Parse an RFC 5322 Date header into ISO-8601 UTC, or undefined when unparsable. */
function normalizeDate(value: string): string | undefined {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString()
}

/** Cutoff instant `sinceHours` hours ago, or undefined when unset. */
function cutoffDate(sinceHours: number | undefined): string | undefined {
  if (sinceHours === undefined) return undefined
  return new Date(Date.now() - sinceHours * 3_600_000).toISOString()
}

/** Extract the EXISTS count from SELECT's untagged responses, or undefined. */
function mailboxExists(untagged: readonly string[]): number | undefined {
  for (const line of untagged) {
    const match = /^(\d+) EXISTS$/.exec(line)
    if (match !== null) return Number(match[1])
  }
  return undefined
}

/** Quote an IMAP mailbox name for SELECT. */
function quoteMailbox(name: string): string {
  return `"${name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/** Quote an IMAP string literal for LOGIN. */
function quoteString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}
