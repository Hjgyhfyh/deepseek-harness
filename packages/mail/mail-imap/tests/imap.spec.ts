import { afterEach, describe, expect, it } from 'vitest'
import { ImapClient } from '../src/client.ts'
import { ImapMailProvider } from '../src/provider.ts'
import type { ImapProviderOptions } from '../src/provider.ts'
import { decodeEncodedWords, pickBodyText, splitMultipart, parseMimePart, unfoldHeaders, parseHeaders, headerValue, charsetOf, decodeText, decodeTransferEncoding } from '../src/mime.ts'
import { literal, startFakeImapServer } from './helpers/fake-imap-server.ts'

let cleanup: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const dispose of cleanup.reverse()) await dispose()
  cleanup = []
})

async function track<T extends { close(): Promise<void> }>(server: T): Promise<T> {
  cleanup.push(() => server.close())
  return server
}

function providerOptions(port: number, overrides: Partial<ImapProviderOptions> = {}): ImapProviderOptions {
  return {
    host: '127.0.0.1',
    port,
    secure: false,
    user: 'effent221@telepasta.ru',
    passwordEnv: 'MAIL_IMAP_PASSWORD',
    resolvePassword: () => Promise.resolve('secret'),
    mailbox: 'INBOX',
    maxScan: 50,
    maxBodyChars: 20_000,
    timeoutMs: 5_000,
    ...overrides,
  }
}

/** One `* n FETCH` line carrying a single header-section literal. */
function headerFetch(sequence: number, uid: string, headers: string, extra = ''): string {
  return `* ${sequence} FETCH (UID ${uid}${extra} BODY[HEADER.FIELDS (FROM SUBJECT DATE)]${literal(headers)})\r\n`
}

describe('ImapMailProvider.list', () => {
  it('lists the newest messages newest-first with header-derived summaries', async () => {
    const server = await track(await startFakeImapServer([
      { match: 'SELECT', respond: [
        '* FLAGS (\\Answered \\Seen)\r\n',
        '* 4 EXISTS\r\n',
        '* OK [UIDVALIDITY 1] UIDs valid\r\n',
      ] },
      { match: 'FETCH', respond: [
        headerFetch(2, '13', 'Date: Thu, 1 Jan 2026 08:00:00 +0000'),
        headerFetch(3, '22', 'From: other@svc.example\r\nSubject: older\r\nDate: Thu, 1 Jan 2026 09:00:00 +0000'),
        headerFetch(4, '31', 'From: codes@svc.example\r\nSubject: =?UTF-8?B?0JrQvtC0?=\r\nDate: Thu, 1 Jan 2026 10:00:00 +0000'),
      ] },
    ]))
    const provider = new ImapMailProvider(() => providerOptions(server.port))
    const result = await provider.list({ limit: 10 })
    expect(result.messages.map(message => message.uid)).toEqual(['31', '22', '13'])
    expect(result.messages[0]).toMatchObject({ from: 'codes@svc.example', subject: 'Код' })
    expect(result.messages[0]?.date).toBe('2026-01-01T10:00:00.000Z')
    // One mailbox message was never returned by the scripted FETCH, so more
    // mail may exist than this listing shows.
    expect(result.truncated).toBe(true)
  })

  it('caps to the request limit without flagging truncation', async () => {
    const server = await track(await startFakeImapServer([
      { match: 'SELECT', respond: [
        '* FLAGS (\\Answered \\Seen)\r\n',
        '* 3 EXISTS\r\n',
      ] },
      { match: 'FETCH', respond: [
        headerFetch(1, '11', 'From: c@x\r\nSubject: s1\r\nDate: Thu, 22 Aug 2026 08:00:00 +0000'),
        headerFetch(2, '22', 'From: b@x\r\nSubject: s2\r\nDate: Thu, 22 Aug 2026 09:00:00 +0000'),
        headerFetch(3, '33', 'From: a@x\r\nSubject: s3\r\nDate: Thu, 22 Aug 2026 10:00:00 +0000'),
      ] },
    ]))
    const provider = new ImapMailProvider(() => providerOptions(server.port))
    const result = await provider.list({ limit: 2 })
    expect(result.messages.map(message => message.uid)).toEqual(['33', '22'])
    // The cap bound the returned listing even though the scan window covered
    // every mailbox message.
    expect(result.truncated).toBe(true)
  })

  it('returns an empty listing for an empty mailbox without fetching', async () => {
    const server = await track(await startFakeImapServer([
      { match: 'SELECT', respond: ['* 0 EXISTS\r\n'] },
    ]))
    const provider = new ImapMailProvider(() => providerOptions(server.port))
    const result = await provider.list({ limit: 10 })
    expect(result).toEqual({ messages: [], truncated: false })
    expect(server.received().some(command => command.startsWith('FETCH'))).toBe(false)
  })

  it('filters by sinceHours against the ISO-normalized Date header', async () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toUTCString()
    const server = await track(await startFakeImapServer([
      { match: 'SELECT', respond: ['* 2 EXISTS\r\n'] },
      { match: 'FETCH', respond: [
        headerFetch(2, '22', 'From: old@x\r\nSubject: old\r\nDate: Mon, 1 Jan 2024 00:00:00 +0000'),
        headerFetch(1, '31', `From: new@x\r\nSubject: new\r\nDate: ${recent}`),
      ] },
    ]))
    const provider = new ImapMailProvider(() => providerOptions(server.port, { sinceHours: 24 }))
    const result = await provider.list({ limit: 10 })
    expect(result.messages.map(message => message.uid)).toEqual(['31'])
  })
})

describe('ImapMailProvider.read', () => {
  it('reads a singlepart text body and never marks it seen', async () => {
    const server = await track(await startFakeImapServer([
      { match: 'SELECT', respond: ['* 1 EXISTS\r\n'] },
      { match: 'UID FETCH', respond: [
        `* 1 FETCH (UID 77 BODY[HEADER.FIELDS (FROM SUBJECT DATE)]${literal('From: noreply@example.com\r\nSubject: Your code')} BODY[TEXT]${literal('Your verification code is 551203.\r\n')})\r\n`,
      ] },
    ]))
    const provider = new ImapMailProvider(() => providerOptions(server.port))
    const result = await provider.read({ uid: '77' })
    expect(result.uid).toBe('77')
    expect(result.subject).toBe('Your code')
    expect(result.from).toBe('noreply@example.com')
    expect(result.text).toContain('551203')
    expect(result.truncated).toBe(false)
    expect(server.received().join('\n')).not.toContain('\\Seen')
  })

  it('decodes a multipart/alternative body to its plain-text leaf', async () => {
    const body = [
      '--bnd1',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from('Код подтверждения: 908172', 'utf8').toString('base64'),
      '--bnd1',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<html><body><p>Code: <b>908172</b></p></body></html>',
      '--bnd1--',
      '',
    ].join('\r\n')
    const server = await track(await startFakeImapServer([
      { match: 'SELECT', respond: ['* 1 EXISTS\r\n'] },
      { match: 'UID FETCH', respond: [
        `* 1 FETCH (UID 64 BODY[HEADER.FIELDS (FROM SUBJECT DATE)]${literal('From: noreply@example.com\r\nSubject: =?UTF-8?Q?=D0=9A=D0=BE=D0=B4?=\r\nContent-Type: multipart/alternative; boundary="bnd1"')} BODY[TEXT]${literal(`${body}`)})\r\n`,
      ] },
    ]))
    const provider = new ImapMailProvider(() => providerOptions(server.port))
    const result = await provider.read({ uid: '64' })
    expect(result.subject).toBe('Код')
    expect(result.text).toBe('Код подтверждения: 908172')
  })

  it('caps the decoded text at maxBodyChars and flags the cut', async () => {
    const server = await track(await startFakeImapServer([
      { match: 'SELECT', respond: ['* 1 EXISTS\r\n'] },
      { match: 'UID FETCH', respond: [
        `* 1 FETCH (UID 50 BODY[HEADER.FIELDS (FROM SUBJECT DATE)]${literal('From: x@y\r\nSubject: long')} BODY[TEXT]${literal('A'.repeat(500))})\r\n`,
      ] },
    ]))
    const provider = new ImapMailProvider(() => providerOptions(server.port, { maxBodyChars: 100 }))
    const result = await provider.read({ uid: '50' })
    expect(result.text).toHaveLength(100)
    expect(result.truncated).toBe(true)
  })

  it('throws MAIL_UNKNOWN_MESSAGE when no message carries the id and rejects non-numeric ids locally', async () => {
    const server = await track(await startFakeImapServer([
      { match: 'SELECT', respond: ['* 1 EXISTS\r\n'] },
      { match: 'UID FETCH', respond: [] },
    ]))
    const provider = new ImapMailProvider(() => providerOptions(server.port))
    await expect(provider.read({ uid: '404' })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_UNKNOWN_MESSAGE' }))
    await expect(provider.read({ uid: 'abc' })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_UNKNOWN_MESSAGE' }))
    expect(server.received().filter(command => command.startsWith('UID FETCH'))).toHaveLength(1)
  })

  it('throws MAIL_CREDENTIAL_MISSING when the password does not resolve', async () => {
    const server = await track(await startFakeImapServer([]))
    const provider = new ImapMailProvider(() => providerOptions(server.port, { resolvePassword: () => Promise.resolve(undefined) }))
    await expect(provider.list({ limit: 5 })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_CREDENTIAL_MISSING' }))
  })
})

describe('ImapMailProvider availability', () => {
  it('is available with complete coordinates and unusable without them', async () => {
    const server = await track(await startFakeImapServer([]))
    expect(new ImapMailProvider(() => providerOptions(server.port)).available()).toBe(true)
    expect(new ImapMailProvider(() => providerOptions(server.port, { host: '' })).available()).toBe(false)
    expect(new ImapMailProvider(() => providerOptions(server.port, { port: 0 })).available()).toBe(false)
    expect(new ImapMailProvider(() => providerOptions(server.port, { passwordEnv: '' })).available()).toBe(false)
    expect(new ImapMailProvider(() => providerOptions(server.port, { resolvePassword: undefined as unknown as () => Promise<string | undefined> })).available()).toBe(false)
  })
})

describe('mime helpers', () => {
  it('unfolds folded headers into logical lines', () => {
    expect(unfoldHeaders('Subject: hello\r\n world\r\nFrom: a@b')).toEqual(['Subject: hello world', 'From: a@b'])
  })

  it('parses headers case-preserving and finds them case-insensitively', () => {
    const headers = parseHeaders('Content-Type: text/plain; charset=UTF-8\r\nX-Odd: 1')
    expect(headerValue(headers, 'content-type')).toBe('text/plain; charset=UTF-8')
    expect(headerValue(headers, 'X-ODD')).toBe('1')
    expect(headerValue(headers, 'missing')).toBeUndefined()
  })

  it('decodes B and Q encoded words and passes malformed ones through', () => {
    expect(decodeEncodedWords('=?UTF-8?B?0JrQvtC0?=')).toBe('Код')
    expect(decodeEncodedWords('=?utf-8?q?a_b?=')).toBe('a b')
    expect(decodeEncodedWords('=??b??=')).toBe('=??b??=')
    expect(decodeEncodedWords('=?nope-charset?B?aGVsbG8=?=')).toBe('=?nope-charset?B?aGVsbG8=?=')
  })

  it('decodes transfer encodings and degrades unknown charsets to utf-8', () => {
    expect(decodeTransferEncoding('aGVsbG8=', 'BASE64').toString('utf8')).toBe('hello')
    expect(decodeTransferEncoding('hi=20there=\r\n', 'quoted-printable').toString('latin1')).toBe('hi there')
    expect(decodeTransferEncoding('plain', undefined).toString('latin1')).toBe('plain')
    expect(charsetOf('text/plain; charset="koi8-r"')).toBe('koi8-r')
    expect(charsetOf('text/plain')).toBe('us-ascii')
    expect(decodeText(Buffer.from([0xd0, 0xb0]), 'utf-8')).toBe('а')
    expect(decodeText(Buffer.from([0xff]), 'not-a-charset')).toBe(new TextDecoder('utf-8').decode(Buffer.from([0xff])))
  })

  it('splits multipart bodies on the boundary and keeps non-multipart bodies whole', () => {
    const raw = 'preamble\r\n--bb\r\nA: 1\r\n\r\none\r\n--bb\r\nB: 2\r\n\r\ntwo\r\n--bb--\r\nepilogue'
    expect(splitMultipart(raw, 'bb')).toEqual(['A: 1\r\n\r\none', 'B: 2\r\n\r\ntwo'])
    expect(splitMultipart('just text', undefined)).toEqual(['just text'])
    expect(splitMultipart('no delimiters', 'bb')).toEqual(['no delimiters'])
  })

  it('parses a part into headers plus payload and picks plain over html', () => {
    const part = parseMimePart('Content-Type: text/plain\r\n\r\nbody here')
    expect(part.headers && headerValue(part.headers, 'content-type')).toBe('text/plain')
    expect(part.text).toBe('body here')
    expect(parseMimePart('no blank line').text).toBe('')
    const chosen = pickBodyText([
      { contentType: 'text/html; charset=utf-8', text: '<p>html</p>' },
      { contentType: 'text/plain; charset=utf-8', text: 'plain' },
    ])
    expect(chosen).toBe('plain')
    expect(pickBodyText([{ contentType: 'application/octet-stream', encoding: 'base64', text: 'aGk=' }])).toBe('hi')
    expect(pickBodyText([])).toBe('')
  })
})

describe('ImapClient framing', () => {
  it('surfaces tagged NO as MAIL_PROVIDER_ERROR', async () => {
    const server = await track(await startFakeImapServer([]))
    const client = new ImapClient({
      host: '127.0.0.1', port: server.port, secure: false,
      user: 'u', password: 'p',
    })
    cleanup.push(async () => client.close())
    await expect(client.command('STATUS INBOX (MESSAGES)')).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_ERROR' }))
  })

  it('reports connection refused as MAIL_PROVIDER_ERROR', async () => {
    const client = new ImapClient({
      host: '127.0.0.1', port: 1, secure: false,
      user: 'u', password: 'p',
    })
    await expect(client.command('NOOP')).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_ERROR' }))
  })
})
