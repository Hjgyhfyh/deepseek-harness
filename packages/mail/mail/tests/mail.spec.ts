import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import MailRuntime, { MailError } from '@deepseek-ai/dsh-mail'
import type {
  MailListProvider,
  MailListRequest,
  MailListResult,
  MailReadProvider,
  MailReadRequest,
  MailReadResult,
} from '@deepseek-ai/dsh-mail'

const available = true
const unavailable = false

function listProvider(
  id: string,
  isAvailable: boolean,
  list: (request: MailListRequest) => Promise<MailListResult>,
): MailListProvider {
  return { id, available: () => isAvailable, list: request => list(request) }
}

function readProvider(
  id: string,
  isAvailable: boolean,
  read: (request: MailReadRequest) => Promise<MailReadResult>,
): MailReadProvider {
  return { id, available: () => isAvailable, read: request => read(request) }
}

function summary(uid: string): MailListResult['messages'][number] {
  return { uid, from: `${uid}@telepasta.ru`, subject: uid }
}

function listResult(...uids: string[]): MailListResult {
  return { messages: uids.map(summary), truncated: false }
}

function readResult(uid: string): MailReadResult {
  return { uid, subject: uid, from: `${uid}@telepasta.ru`, text: `body ${uid}`, truncated: false }
}

/** Mount a MailRuntime on a fresh root context with the given config. */
async function mountMail(config: ConstructorParameters<typeof MailRuntime>[1] = {}): Promise<{ ctx: Context; mail: MailRuntime }> {
  const ctx = new Context()
  await ctx.plugin(MailRuntime, config)
  return { ctx, mail: ctx.mail }
}

describe('MailRuntime registration', () => {
  it('registers a list provider and unregisters it via the returned disposer', async () => {
    const { mail } = await mountMail()

    const dispose = mail.registerListProvider(listProvider('imap', available, () => Promise.resolve(listResult('10'))))
    await expect(mail.list({ limit: 5 })).resolves.toMatchObject({ messages: [expect.objectContaining({ uid: '10' })] })

    dispose()
    await expect(mail.list({ limit: 5 })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_UNAVAILABLE' }))
  })

  it('throws MAIL_DUPLICATE_PROVIDER on a duplicate list id', async () => {
    const { mail } = await mountMail()
    mail.registerListProvider(listProvider('imap', available, () => Promise.resolve(listResult())))
    expect(() => mail.registerListProvider(listProvider('imap', available, () => Promise.resolve(listResult()))))
      .toThrow(expect.objectContaining({ code: 'MAIL_DUPLICATE_PROVIDER' }))
  })

  it('throws MAIL_DUPLICATE_PROVIDER on a duplicate read id', async () => {
    const { mail } = await mountMail()
    const provider = readProvider('imap', available, request => Promise.resolve(readResult(request.uid)))
    mail.registerReadProvider(provider)
    expect(() => mail.registerReadProvider(provider)).toThrow(expect.objectContaining({ code: 'MAIL_DUPLICATE_PROVIDER' }))
  })

  it('keeps list and read id namespaces independent', async () => {
    const { mail } = await mountMail()
    mail.registerListProvider(listProvider('shared', available, () => Promise.resolve(listResult())))
    expect(() => mail.registerReadProvider(readProvider('shared', available, request => Promise.resolve(readResult(request.uid))))).not.toThrow()
  })

  it('disposes provider registrations when the contributing fiber is disposed (HMR safety)', async () => {
    const { ctx, mail } = await mountMail()
    const fiber = await ctx.plugin(Object.assign((inner: Context) => {
      inner.mail.registerListProvider(listProvider('imap', available, () => Promise.resolve(listResult('1'))))
    }, { inject: ['mail'] }))
    await expect(mail.list({ limit: 5 })).resolves.toMatchObject({ messages: [expect.objectContaining({ uid: '1' })] })
    await fiber.dispose()
    await expect(mail.list({ limit: 5 })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_UNAVAILABLE' }))
  })
})

describe('MailRuntime execution resolution', () => {
  it('throws MAIL_PROVIDER_UNAVAILABLE when nothing is registered', async () => {
    const { mail } = await mountMail()
    await expect(mail.list({ limit: 5 })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_UNAVAILABLE' }))
  })

  it('throws MAIL_PROVIDER_UNAVAILABLE when providers exist but none are usable', async () => {
    const { mail } = await mountMail()
    mail.registerListProvider(listProvider('imap', unavailable, () => Promise.resolve(listResult())))
    await expect(mail.list({ limit: 5 })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_UNAVAILABLE' }))
  })

  it('throws MAIL_PROVIDER_CONFIGURED_MISSING for an unregistered configured id', async () => {
    const { mail } = await mountMail({ listProvider: 'other' })
    mail.registerListProvider(listProvider('imap', available, () => Promise.resolve(listResult())))
    await expect(mail.list({ limit: 5 })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_CONFIGURED_MISSING' }))
  })

  it('throws MAIL_PROVIDER_CONFIGURED_UNAVAILABLE for an unusable configured id', async () => {
    const { mail } = await mountMail({ listProvider: 'imap' })
    mail.registerListProvider(listProvider('imap', unavailable, () => Promise.resolve(listResult())))
    await expect(mail.list({ limit: 5 })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_CONFIGURED_UNAVAILABLE' }))
  })

  it('throws MAIL_PROVIDER_AMBIGUOUS rather than picking by order', async () => {
    const { mail } = await mountMail()
    mail.registerListProvider(listProvider('a', available, () => Promise.resolve(listResult())))
    mail.registerListProvider(listProvider('b', available, () => Promise.resolve(listResult())))
    await expect(mail.list({ limit: 5 })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_AMBIGUOUS' }))
  })

  it('runs the configured provider even when another usable provider is registered', async () => {
    const { mail } = await mountMail({ listProvider: 'b' })
    mail.registerListProvider(listProvider('a', available, () => Promise.resolve(listResult('a'))))
    mail.registerListProvider(listProvider('b', available, () => Promise.resolve(listResult('b'))))
    await expect(mail.list({ limit: 5 })).resolves.toMatchObject({ messages: [expect.objectContaining({ uid: 'b' })] })
  })

  it('ignores unusable providers when auto-selecting and does not depend on registration order', async () => {
    const first = await mountMail()
    first.mail.registerListProvider(listProvider('a', unavailable, () => Promise.resolve(listResult())))
    first.mail.registerListProvider(listProvider('b', available, () => Promise.resolve(listResult('b'))))
    await expect(first.mail.list({ limit: 5 })).resolves.toMatchObject({ messages: [expect.objectContaining({ uid: 'b' })] })

    const second = await mountMail()
    second.mail.registerListProvider(listProvider('b', available, () => Promise.resolve(listResult('b'))))
    second.mail.registerListProvider(listProvider('a', unavailable, () => Promise.resolve(listResult())))
    await expect(second.mail.list({ limit: 5 })).resolves.toMatchObject({ messages: [expect.objectContaining({ uid: 'b' })] })
  })

  it('feeds env overrides into the same configured-id fields as config', async () => {
    const previous = process.env.DSH_MAIL_LIST_PROVIDER
    process.env.DSH_MAIL_LIST_PROVIDER = 'env-provider'
    try {
      const { mail } = await mountMail()
      mail.registerListProvider(listProvider('config-provider', available, () => Promise.resolve(listResult('config'))))
      mail.registerListProvider(listProvider('env-provider', available, () => Promise.resolve(listResult('env'))))
      await expect(mail.list({ limit: 5 })).resolves.toMatchObject({ messages: [expect.objectContaining({ uid: 'env' })] })
    } finally {
      if (previous === undefined) delete process.env.DSH_MAIL_LIST_PROVIDER
      else process.env.DSH_MAIL_LIST_PROVIDER = previous
    }
  })
})

describe('MailRuntime limit enforcement', () => {
  it('keeps the newest limit messages and sets truncated when a provider over-returns', async () => {
    const { mail } = await mountMail()
    mail.registerListProvider(listProvider('imap', available, () => Promise.resolve(listResult('30', '20', '10'))))
    const result = await mail.list({ limit: 2 })
    expect(result.messages.map(message => message.uid)).toEqual(['30', '20'])
    expect(result.truncated).toBe(true)
  })

  it('leaves truncated false when within the bound', async () => {
    const { mail } = await mountMail()
    mail.registerListProvider(listProvider('imap', available, () => Promise.resolve(listResult('10'))))
    const result = await mail.list({ limit: 2 })
    expect(result.messages).toHaveLength(1)
    expect(result.truncated).toBe(false)
  })

  it('does not bound a result already within the requested limit', async () => {
    const { mail } = await mountMail()
    mail.registerListProvider(listProvider('imap', available, () => Promise.resolve(listResult('2', '1'))))
    const result = await mail.list({ limit: 5 })
    expect(result.messages.map(message => message.uid)).toEqual(['2', '1'])
    expect(result.truncated).toBe(false)
  })
})

describe('MailRuntime read capability', () => {
  it('resolves and runs the read provider independently of list', async () => {
    const { mail } = await mountMail()
    mail.registerReadProvider(readProvider('imap', available, request => Promise.resolve(readResult(request.uid))))
    const result = await mail.read({ uid: '42' })
    expect(result.text).toBe('body 42')
  })

  it('throws MAIL_PROVIDER_UNAVAILABLE for read when no read provider is registered', async () => {
    const { mail } = await mountMail()
    mail.registerListProvider(listProvider('imap', available, () => Promise.resolve(listResult())))
    await expect(mail.read({ uid: '42' })).rejects.toThrow(expect.objectContaining({ code: 'MAIL_PROVIDER_UNAVAILABLE' }))
  })

  it('propagates the abort signal to both capability kinds', async () => {
    const { mail } = await mountMail()
    const seen: (AbortSignal | undefined)[] = []
    mail.registerListProvider({
      id: 'imap',
      available: () => available,
      list: (_request, signal) => { seen.push(signal); return Promise.resolve(listResult()) },
    })
    mail.registerReadProvider({
      id: 'imap',
      available: () => available,
      read: (_request, signal) => { seen.push(signal); return Promise.resolve(readResult('1')) },
    })
    const controller = new AbortController()
    await mail.list({ limit: 5 }, controller.signal)
    await mail.read({ uid: '1' }, controller.signal)
    expect(seen[0]).toBe(controller.signal)
    expect(seen[1]).toBe(controller.signal)
  })
})

describe('MailError', () => {
  it('is a HarnessError carrying its code', () => {
    const error = new MailError('boom', 'MAIL_UNKNOWN_MESSAGE')
    expect(error.code).toBe('MAIL_UNKNOWN_MESSAGE')
    expect(error.name).toBe('MailError')
  })
})
