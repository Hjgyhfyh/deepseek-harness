/**
 * Minimal IMAP4rev1 client for the mailbox seam's needs: one-shot connections
 * that log in, run one or two commands, and close. Speaks tag-prefixed command
 * lines, parses untagged/fetch responses, and translates every protocol-level
 * failure into {@link MailError} codes. TLS wraps the socket when `secure` is
 * set; otherwise the connection is plaintext STARTTLS-less IMAP (a private-VPS
 * deployment choice, not a default anywhere).
 * @module @deepseek-ai/dsh-mail-imap/client
 */

import { connect, type Socket } from 'node:net'
import { connect as tlsConnect, type TLSSocket } from 'node:tls'
import { MailError } from '@deepseek-ai/dsh-mail'

/** Transport options for one IMAP connection. */
export interface ImapConnectionOptions {
  readonly host: string
  readonly port: number
  /** Wrap the socket in TLS immediately (implicit TLS, usually port 993). */
  readonly secure?: boolean
  /** Login user (often the full address). */
  readonly user: string
  /** Login password; resolved per connection, never stored by the client. */
  readonly password: string
}

/** One fetched message: the raw header block plus the raw body-section bytes. */
export interface FetchedMessage {
  /** RFC 3501 2.3.2 unique identifier as a decimal string. */
  readonly uid: string
  /** Concatenated `BODY[…HEADER…]` section bytes, in server order. */
  readonly headerBytes: Buffer
  /** Concatenated non-header section bytes (`BODY[TEXT]`, `BODY[n]`). */
  readonly bodyBytes: Buffer
}

/** Largest buffered response (lines plus literals) before declaring the server hostile. */
const MAX_BUFFER_BYTES = 8_000_000

/** Longest single response line the client buffers. */
const MAX_LINE_BYTES = 64 * 1024

/** Options for {@link ImapClient.command}. */
export interface CommandOptions {
  /** Aborts the in-flight command and closes the socket. */
  readonly signal?: AbortSignal
  /**
   * How many `BODY[…]` section literals one FETCH response carries. The
   * command consumes exactly that many literals after a `* n FETCH` line;
   * other commands must leave this unset.
   */
  readonly fetchSections?: number
}

/**
 * One IMAP session over a single socket connection. Commands are serialized
 * (await each before the next); the socket opens lazily on the first command
 * and closes on {@link close} or abort. The line reader persists across
 * commands, so bytes arriving between commands stay buffered.
 */
export class ImapClient {
  private socket: Socket | TLSSocket | undefined
  private reader: LineReader | undefined
  private greeted = false

  constructor(private readonly options: ImapConnectionOptions) {}

  /**
   * Run one command and collect its untagged and FETCH responses.
   * @param command - the command line without tag or CRLF.
   * @param options - cancellation signal and expected FETCH section count.
   * @returns untagged response lines (without the `* ` prefix) and the fetched
   *   messages in server order.
   */
  async command(command: string, options: CommandOptions = {}): Promise<{ untagged: string[]; fetched: FetchedMessage[] }> {
    const socket = await this.ensureSocket(options.signal)
    this.reader ??= createLineReader(socket)
    return await this.converse(socket, this.reader, command, options)
  }

  /** Close the socket; safe to call more than once. */
  close(): void {
    const socket = this.socket
    this.socket = undefined
    this.reader = undefined
    if (socket !== undefined) socket.destroy()
  }

  private async ensureSocket(signal?: AbortSignal): Promise<Socket | TLSSocket> {
    if (this.socket !== undefined) return this.socket
    const created = await new Promise<Socket | TLSSocket>((resolve, reject) => {
      const base = connect({ host: this.options.host, port: this.options.port })
      const finish = (socket: Socket | TLSSocket): void => {
        cleanup()
        resolve(socket)
      }
      const fail = (error: Error): void => {
        cleanup()
        base.destroy()
        reject(new MailError(`cannot connect to IMAP server ${this.options.host}:${this.options.port}: ${error.message}`, 'MAIL_PROVIDER_ERROR', { cause: error }))
      }
      const onAbort = (): void => fail(new Error('aborted'))
      const cleanup = (): void => {
        base.removeListener('connect', onConnect)
        base.removeListener('error', onError)
        signal?.removeEventListener('abort', onAbort)
      }
      const onConnect = (): void => {
        if (this.options.secure === true) {
          const tls = tlsConnect({ socket: base, servername: this.options.host })
          tls.once('error', onError)
          tls.once('secureConnect', () => finish(tls))
        } else {
          finish(base)
        }
      }
      const onError = (error: Error): void => fail(error)
      base.once('connect', onConnect)
      base.once('error', onError)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
    this.socket = created
    return created
  }

  /** Write the tagged command and read responses until the matching tag. */
  private async converse(
    socket: Socket | TLSSocket,
    reader: LineReader,
    command: string,
    options: CommandOptions,
  ): Promise<{ untagged: string[]; fetched: FetchedMessage[] }> {
    const signal = options.signal
    const tag = `A${nextTagId()}`
    const untagged: string[] = []
    const fetched: FetchedMessage[] = []

    if (!this.greeted) {
      assertNotBye((await reader.next(signal)).line)
      this.greeted = true
    }

    socket.write(`${tag} ${command}\r\n`)
    for (;;) {
      if (signal?.aborted) {
        socket.destroy()
        throw new MailError('IMAP command aborted', 'MAIL_ABORTED')
      }
      const { line, literal } = await reader.next(signal)
      assertNotBye(line)
      if (line.startsWith(`${tag} `)) {
        const status = line.slice(tag.length + 1)
        if (!status.startsWith('OK')) {
          throw new MailError(`IMAP command failed: ${status}`, 'MAIL_PROVIDER_ERROR')
        }
        return { untagged, fetched }
      }
      if (line.startsWith('* ')) {
        const body = line.slice(2)
        const piece: NextLine = literal === undefined ? { line: body } : { line: body, literal }
        const message = await readFetchedMessage(body, piece, reader, signal, options.fetchSections ?? 0)
        if (message !== undefined) {
          fetched.push(message)
          continue
        }
        if (literal !== undefined) {
          // A literal on a non-FETCH untagged line (e.g. LIST): keep the pair
          // together so callers can still see the raw shape.
          untagged.push(`${body}{${literal.length}}`, literal.toString('latin1'))
          continue
        }
        untagged.push(body)
      }
      // Continuation fragments between FETCH literals (e.g. `)`), mailbox-data
      // replies this seam does not model, and `+ ` continuations are ignored:
      // this client sends no commands that legitimately elicit them.
    }
  }
}

let tagCounter = 0

function nextTagId(): number {
  tagCounter = (tagCounter + 1) % 10_000
  return tagCounter
}

/** Abort the session when the server announces `* BYE` mid-command. */
function assertNotBye(line: string): void {
  if (line.startsWith('* BYE')) {
    throw new MailError('IMAP server closed the session (BYE)', 'MAIL_PROVIDER_ERROR')
  }
}

/** One reader step: a CRLF-terminated line plus its trailing literal, if any. */
export interface NextLine {
  readonly line: string
  /** Literal bytes announced by a trailing `{n}` on {@link line}. */
  readonly literal?: Buffer
}

interface LineReader {
  next(signal?: AbortSignal): Promise<NextLine>
}

/**
 * Byte-counting line reader owning one socket's stream for the whole session.
 * `next()` resolves one CRLF-terminated line; when the line ends in `{n}` the
 * following `n` literal bytes are consumed and returned alongside, keeping the
 * byte stream framed for the caller.
 */
function createLineReader(socket: Socket | TLSSocket): LineReader {
  let buffer = Buffer.alloc(0)
  let ended = false
  let failure: Error | undefined
  const waiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = []

  const wakeAll = (): void => {
    while (waiters.length > 0) waiters.shift()?.resolve()
  }
  const fail = (error: Error): void => {
    failure = error
    while (waiters.length > 0) waiters.shift()?.reject(error)
    socket.destroy()
  }
  const onData = (chunk: Buffer): void => {
    buffer = buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([buffer, chunk])
    if (buffer.length > MAX_BUFFER_BYTES) {
      fail(new MailError(`IMAP response exceeds ${MAX_BUFFER_BYTES} buffered bytes`, 'MAIL_PROVIDER_ERROR'))
      return
    }
    wakeAll()
  }
  const onEnd = (): void => {
    ended = true
    wakeAll()
  }
  const onError = (error: Error): void => fail(error)
  socket.on('data', onData)
  socket.on('end', onEnd)
  socket.on('error', onError)

  /** Pop one complete CRLF line from the buffer, or undefined. */
  function takeLine(): string | undefined {
    const index = buffer.indexOf(13)
    if (index === -1 || index + 1 >= buffer.length) return undefined
    if (buffer[index + 1] !== 10) {
      throw new MailError('IMAP response line is not CRLF-terminated', 'MAIL_PROVIDER_ERROR')
    }
    const line = buffer.subarray(0, index)
    buffer = buffer.subarray(index + 2)
    if (line.length > MAX_LINE_BYTES) {
      throw new MailError('IMAP response line exceeds the length cap', 'MAIL_PROVIDER_ERROR')
    }
    return line.toString('utf8')
  }

  /** Resolve when more bytes may be buffered, ended, or failed. */
  async function waitForData(signal?: AbortSignal): Promise<void> {
    if (failure !== undefined) throw failure
    if (ended) return
    await new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject }
      waiters.push(waiter)
      signal?.addEventListener('abort', () => {
        const index = waiters.indexOf(waiter)
        if (index >= 0) waiters.splice(index, 1)
        reject(new MailError('IMAP command aborted', 'MAIL_ABORTED'))
      }, { once: true })
    })
  }

  /** Resolve exactly `size` literal bytes from the stream. */
  async function takeLiteral(size: number, signal?: AbortSignal): Promise<Buffer> {
    for (;;) {
      if (failure !== undefined) throw failure
      if (buffer.length >= size) {
        const bytes = buffer.subarray(0, size)
        buffer = buffer.subarray(size)
        return bytes
      }
      if (ended) {
        throw new MailError('IMAP connection closed mid-literal', 'MAIL_PROVIDER_ERROR')
      }
      await waitForData(signal)
    }
  }

  return {
    async next(signal?: AbortSignal): Promise<NextLine> {
      for (;;) {
        if (failure !== undefined) throw failure
        const line = takeLine()
        if (line !== undefined) {
          const literalMatch = /\{(\d+)\}$/.exec(line)
          if (literalMatch === null) return { line }
          const size = Number(literalMatch[1])
          if (!Number.isInteger(size) || size < 0 || size > MAX_BUFFER_BYTES) {
            throw new MailError(`IMAP literal size ${String(literalMatch[1])} is out of bounds`, 'MAIL_PROVIDER_ERROR')
          }
          const literal = await takeLiteral(size, signal)
          return { line, literal }
        }
        if (ended) {
          throw new MailError('IMAP connection closed before the command completed', 'MAIL_PROVIDER_ERROR')
        }
        await waitForData(signal)
      }
    },
  }
}

/**
 * Parse one `* <n> FETCH …` line into a {@link FetchedMessage}, consuming the
 * message's section literals through the reader. Returns undefined for
 * non-FETCH untagged lines. Exactly `sections` trailing `BODY[…]` nstring
 * literals are consumed. RFC 3501 `msg-att-static` puts SP between `]` and
 * the nstring (`BODY[…] {n}`), which Dovecot emits; a glued `]{n}` form is
 * also accepted. A server sending fewer literals fails the message instead of
 * desynchronizing the stream.
 */
async function readFetchedMessage(
  body: string,
  first: NextLine,
  reader: LineReader,
  signal: AbortSignal | undefined,
  sections: number,
): Promise<FetchedMessage | undefined> {
  const match = /^(\d+) FETCH \((.*)$/s.exec(body)
  if (match === null) return undefined
  const uidMatch = /\bUID (\d+)/.exec(match[2] ?? '')
  const uid = uidMatch?.[1] ?? (match[1] ?? '')
  let headerBytes = Buffer.alloc(0)
  let bodyBytes = Buffer.alloc(0)
  let piece = first
  for (let captured = 0; captured < sections; captured++) {
    const marker = /(?:^|\s)(BODY\[[^\]]*\])\s*\{\d+\}$/.exec(piece.line)
    if (marker === null || piece.literal === undefined) {
      throw new MailError(`IMAP FETCH response carried ${captured} of ${sections} expected section literals`, 'MAIL_PROVIDER_ERROR')
    }
    if (/HEADER/.test(marker[1] ?? '')) {
      headerBytes = Buffer.concat([headerBytes, piece.literal])
    } else {
      bodyBytes = Buffer.concat([bodyBytes, piece.literal])
    }
    if (captured + 1 < sections) {
      piece = await reader.next(signal)
      assertNotBye(piece.line)
    }
  }
  return { uid, headerBytes, bodyBytes }
}
