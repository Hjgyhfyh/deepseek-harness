/**
 * A scripted in-process IMAP server for provider tests: one TCP listener that
 * answers LOGIN/SELECT/FETCH per a per-test script and records the received
 * command lines. Responses are plain strings the test composes by hand, so the
 * suite pins the provider against the wire shapes a real Dovecot emits.
 * @module tests/fake-imap-server
 */

import { createServer, type Server, type Socket } from 'node:net'
import { AddressInfo } from 'node:net'

/** One scripted exchange: match the command line, emit response chunks. */
interface ScriptedCommand {
  /** Substring the received command line must contain to match. */
  readonly match: string
  /** Response chunks written in order; each MUST end with `\r\n` and may
   *  embed `{n}` literal framing. */
  readonly respond: string[]
}

/** A running fake server: the bound port plus the commands it received. */
export interface FakeImapServer {
  readonly port: number
  /** Close the listener and every open connection. */
  close(): Promise<void>
  /** Command lines received so far, in order, without tags or CRLF. */
  received(): readonly string[]
}

/** Greeting + scripted replies for every matched command; unmatched → tagged NO.
 *  LOGIN is always answered OK first: every provider operation logs in before
 *  any scripted command runs. */
export async function startFakeImapServer(script: ScriptedCommand[]): Promise<FakeImapServer> {
  const fullScript: ScriptedCommand[] = [{ match: 'LOGIN', respond: [] }, ...script]
  const received: string[] = []
  const sockets: Socket[] = []
  const server: Server = createServer((socket) => {
    sockets.push(socket)
    let buffer = ''
    socket.write('* OK Fake IMAP ready\r\n')
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      for (;;) {
        const eol = buffer.indexOf('\r\n')
        if (eol === -1) return
        const line = buffer.slice(0, eol)
        buffer = buffer.slice(eol + 2)
        const space = line.indexOf(' ')
        if (space === -1) continue
        const tag = line.slice(0, space)
        const command = line.slice(space + 1)
        received.push(command)
        const hit = fullScript.find(entry => command.includes(entry.match))
        if (hit === undefined) {
          socket.write(`${tag} NO unscripted command\r\n`)
          continue
        }
        for (const piece of hit.respond) socket.write(piece)
        socket.write(`${tag} OK done\r\n`)
      }
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    port: (server.address() as AddressInfo).port,
    async close(): Promise<void> {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>(resolve => server.close(() => resolve()))
    },
    received: () => received,
  }
}

/**
 * Frame `bytes` as one IMAP nstring literal after a `BODY[…]` section.
 * RFC 3501 `msg-att-static` is `BODY SP "[" section "]" SP nstring`; Dovecot
 * emits the SP before `{n}`, so fixtures keep that space.
 */
export function literal(bytes: string | Buffer): string {
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8')
  return ` {${payload.length}}\r\n${payload.toString('latin1')}`
}

/** Build one FETCH response line pair for a message with the given sections. */
export function fetchResponse(uid: number, sections: string[]): string {
  const inner = [`UID ${uid}`, ...sections.map((section, index) => `BODY[${index === 0 ? 'HEADER.FIELDS (FROM SUBJECT DATE)' : 'TEXT'}]${literal(section)}`)]
  return `* 1 FETCH (${inner.join(' ')})\r\n`
}
