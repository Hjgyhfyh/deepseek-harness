/**
 * Unit coverage for the model-facing mail tools: argument parsing, output
 * formatting, presentation views and their replayable meta, registration and
 * enablement, and execution through the real tool registry against stub
 * providers registered on a real `MailRuntime`.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { ToolResult } from '@deepseek-ai/dsh-tools'
import MailRuntime from '@deepseek-ai/dsh-mail'
import type { MailListProvider, MailListResult, MailReadProvider, MailReadResult } from '@deepseek-ai/dsh-mail'
import * as ToolMail from '@deepseek-ai/dsh-tool-mail'
import { MailError } from '@deepseek-ai/dsh-mail'
import {
  codesMetaFromResult,
  codesMetaFromValue,
  MAIL_ACCESS_PROMPT,
  mailAccessPrompt,
  formatCodesOutput,
  formatListOutput,
  formatReadOutput,
  listMetaFromResult,
  listMetaFromValue,
  MAIL_LIST_MAX_RESULTS,
  parseListArgs,
  parseReadArgs,
  presentCodesCall,
  presentCodesResult,
  presentListCall,
  presentListResult,
  presentReadCall,
  presentReadResult,
  readMetaFromResult,
  readMetaFromValue,
} from '@deepseek-ai/dsh-tool-mail'

const testToolSignal = new AbortController().signal

interface ListSeen {
  limit?: number
  signal?: AbortSignal | undefined
}

interface ReadSeen {
  uid?: string
  signal?: AbortSignal | undefined
}

function listProvider(result: MailListResult, seen?: ListSeen): MailListProvider {
  return {
    id: 'stub-list',
    available: () => true,
    list: (request, signal) => {
      if (seen !== undefined) {
        seen.limit = request.limit
        seen.signal = signal
      }
      return Promise.resolve(result)
    },
  }
}

function readProvider(result: MailReadResult, seen?: ReadSeen): MailReadProvider {
  return {
    id: 'stub-read',
    available: () => true,
    read: (request, signal) => {
      if (seen !== undefined) {
        seen.uid = request.uid
        seen.signal = signal
      }
      return Promise.resolve(result)
    },
  }
}

function sampleListResult(): MailListResult {
  return {
    messages: [
      { uid: '31', from: 'codes@svc.example', subject: 'Код', date: '2026-08-22T10:00:00.000Z' },
      // Bare row: no subject, no date — exercises both optional branches.
      { uid: '22', from: 'noreply@x.example', subject: '' },
    ],
    truncated: true,
  }
}

function sampleReadResult(): MailReadResult {
  return { uid: '31', subject: 'Код подтверждения', from: 'codes@svc.example', text: 'Your code is 551203.', truncated: false }
}

/** Mount the real registries, the mail seam, and tool-mail; return an executor helper. */
async function mountTools(opts: {
  config?: ToolMail.Config
  list?: MailListProvider
  read?: MailReadProvider
} = {}): Promise<{ ctx: Context; fiber: Awaited<ReturnType<Context['plugin']>>; call: (name: string, args: unknown) => Promise<ToolExecutionResult> }> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(MailRuntime, {})
  if (opts.list !== undefined) ctx.mail.registerListProvider(opts.list)
  if (opts.read !== undefined) ctx.mail.registerReadProvider(opts.read)
  const fiber = await ctx.plugin(ToolMail, opts.config ?? {})
  let counter = 0
  const call = (name: string, args: unknown) =>
    ctx.tools.execute({ signal: testToolSignal, callId: CallId(`call-${++counter}`), name, arguments: args })
  return { ctx, fiber, call }
}

/** Build a completed non-error tool result with the given meta and text content. */
function toolResult(meta: unknown, text = 'body', isError = false): ToolResult {
  const content: ContentBlock[] = [{ type: 'text', text }]
  return { content, isError, ...meta !== undefined ? { meta: meta as never } : {} }
}

describe('list formatting', () => {
  it('renders sender, id, subject, and date rows plus a mail_read pointer', () => {
    const out = formatListOutput(sampleListResult())
    expect(out).toContain('- codes@svc.example [id: 31] — Код — 2026-08-22T10:00:00.000Z')
    expect(out).toContain('- noreply@x.example [id: 22]')
    expect(out).toContain('Use mail_read with one of the ids above to see its full text.')
  })

  it('notes more messages beyond the shown count when truncated', () => {
    expect(formatListOutput(sampleListResult())).toContain('(More messages exist beyond the 2 shown.)')
  })

  it('reports an empty mailbox without a pointer or a truncation note', () => {
    const out = formatListOutput({ messages: [], truncated: false })
    expect(out).toContain('No messages found.')
    expect(out).not.toContain('mail_read')
    expect(out).not.toContain('More messages')
  })

  it('omits the more-messages note when nothing was left behind', () => {
    const out = formatListOutput({
      messages: [{ uid: '1', from: 'a@b', subject: 's', date: '2026-08-22T10:00:00.000Z' }],
      truncated: false,
    })
    expect(out).toContain('[id: 1]')
    expect(out).not.toContain('More messages')
  })
})

describe('read formatting', () => {
  it('renders the message header block followed by the decoded body', () => {
    const rendered = formatReadOutput(sampleReadResult(), 40_000)
    expect(rendered.text).toBe('Message 31 — Код подтверждения\nFrom: codes@svc.example\n\nYour code is 551203.')
    expect(rendered.truncated).toBe(false)
  })

  it('falls back to (no subject) and flags a provider-side cut with the footer', () => {
    const rendered = formatReadOutput(
      { uid: '9', subject: '', from: 'f@x', text: 'body', truncated: true },
      40_000,
    )
    expect(rendered.text.startsWith('Message 9 — (no subject)\nFrom: f@x\n\nbody')).toBe(true)
    expect(rendered.text).toContain('(Message truncated.')
    expect(rendered.truncated).toBe(true)
  })

  it('caps the complete output and appends the footer when the cap binds', () => {
    const rendered = formatReadOutput(
      { uid: '9', subject: 's', from: 'f@x', text: 'A'.repeat(500), truncated: false },
      100,
    )
    expect(rendered.text.length).toBeLessThanOrEqual(100)
    expect(rendered.text).toContain('(Message truncated.')
    expect(rendered.truncated).toBe(true)
  })

  it('keeps an exact-cap output intact without the footer', () => {
    const value = sampleReadResult()
    const prefix = `Message ${value.uid} — ${value.subject}\nFrom: ${value.from}\n\n${value.text}`
    const rendered = formatReadOutput(value, prefix.length)
    expect(rendered).toEqual({ text: prefix, truncated: false })
  })

  it('hard-slices when the cap cannot fit the footer', () => {
    const value: MailReadResult = { uid: '31', subject: '', from: 'f@x', text: 'abcdef', truncated: false }
    const prefix = `Message 31 — (no subject)\nFrom: f@x\n\nabcdef`
    const rendered = formatReadOutput(value, 10)
    expect(rendered).toEqual({ text: prefix.slice(0, 10), truncated: true })
  })
})

describe('argument parsing', () => {
  it('passes list arguments through and rejects non-positive-integer limits', () => {
    expect(parseListArgs({})).toEqual({})
    expect(parseListArgs({ limit: 3 })).toEqual({ limit: 3 })
    expect(() => parseListArgs({ limit: 0 })).toThrow('limit must be a positive integer')
    expect(() => parseListArgs({ limit: 1.5 })).toThrow('limit must be a positive integer')
    expect(() => parseListArgs({ limit: -2 })).toThrow('limit must be a positive integer')
  })

  it('rejects blank read ids and keeps usable ones', () => {
    expect(parseReadArgs({ uid: '31' })).toEqual({ uid: '31' })
    expect(() => parseReadArgs({ uid: '' })).toThrow('uid must be a non-empty string')
    expect(() => parseReadArgs({ uid: '   ' })).toThrow('uid must be a non-empty string')
  })
})

describe('presentation', () => {
  it('presents pending calls as fetch cards titled by the request', () => {
    expect(presentListCall({ limit: 3 })).toEqual({ card: 'generic', title: 'Listing recent mail', kind: 'fetch', rawInput: { limit: 3 } })
    expect(presentReadCall({ uid: '42' })).toEqual({ card: 'generic', title: '42', kind: 'fetch', rawInput: '42' })
    expect(presentCodesCall({ limit: 3 })).toEqual({ card: 'generic', title: 'Listing verification codes', kind: 'fetch', rawInput: { limit: 3 } })
  })

  it('derives the completed list card from meta, falling back to the sender for a bare subject', () => {
    const meta = listMetaFromValue({
      messages: [
        { uid: '31', from: 'a@b', subject: 's', date: '2026-08-22T10:00:00.000Z' },
        { uid: '9', from: 'f@x', subject: '' },
      ],
      truncated: false,
    })
    expect(presentListResult({ limit: 5 }, toolResult(meta))).toEqual({
      card: 'web',
      kind: 'search',
      title: 'Recent mail',
      sources: [
        { url: 'mail:31', title: 's', snippet: '2026-08-22T10:00:00.000Z' },
        { url: 'mail:9', title: 'f@x', snippet: undefined },
      ],
      truncated: false,
    })
  })

  it('falls back to the generic card for failed calls or malformed meta', () => {
    const meta = listMetaFromValue({ messages: [], truncated: false })
    expect(presentListResult({}, toolResult(meta, 'body', true))).toBeUndefined()
    expect(presentListResult({}, toolResult(undefined))).toBeUndefined()
    expect(presentListResult({}, toolResult({ messages: 'nope' }))).toBeUndefined()

    const readMeta = readMetaFromValue(sampleReadResult(), 40_000)
    expect(presentReadResult({ uid: '31' }, toolResult(readMeta, 'body', true))).toBeUndefined()
    expect(presentReadResult({ uid: '31' }, toolResult('garbage'))).toBeUndefined()
  })

  it('derives the completed read card carrying the effective truncation', () => {
    const meta = readMetaFromValue(sampleReadResult(), 40_000)
    expect(presentReadResult({ uid: '31' }, toolResult(meta))).toEqual({
      card: 'web',
      kind: 'fetch',
      title: '31',
      url: 'mail:31',
      statusCode: 200,
      truncated: false,
    })
  })
})

describe('presentation meta', () => {
  it('projects list summaries, keeping date only when present', () => {
    const meta = listMetaFromValue(sampleListResult())
    expect(meta).toEqual({
      messages: [
        { uid: '31', from: 'codes@svc.example', subject: 'Код', date: '2026-08-22T10:00:00.000Z' },
        { uid: '22', from: 'noreply@x.example', subject: '' },
      ],
    })
  })

  it('round-trips list meta through its narrowing', () => {
    const value = sampleListResult()
    expect(listMetaFromResult(listMetaFromValue(value))).toEqual(listMetaFromValue(value))
  })

  it('narrows malformed list meta to undefined instead of throwing on replay', () => {
    expect(listMetaFromResult(undefined)).toBeUndefined()
    expect(listMetaFromResult(null)).toBeUndefined()
    expect(listMetaFromResult('garbage')).toBeUndefined()
    expect(listMetaFromResult([])).toBeUndefined()
    expect(listMetaFromResult({})).toBeUndefined()
    expect(listMetaFromResult({ messages: 'nope' })).toBeUndefined()
    expect(listMetaFromResult({ messages: [null] })).toBeUndefined()
    expect(listMetaFromResult({ messages: [{ uid: 1, from: 'a', subject: 'b' }] })).toBeUndefined()
    expect(listMetaFromResult({ messages: [{ uid: '1', from: 2, subject: 'b' }] })).toBeUndefined()
    expect(listMetaFromResult({ messages: [{ uid: '1', from: 'a', subject: 3 }] })).toBeUndefined()
    expect(listMetaFromResult({ messages: [{ uid: '1', from: 'a', subject: 'b', date: 5 }] })).toBeUndefined()
    expect(listMetaFromResult({ messages: [{ uid: '1', from: 'a', subject: 'b' }] })).toEqual({
      messages: [{ uid: '1', from: 'a', subject: 'b' }],
    })
  })

  it('projects the read summary with the effective, not provider-only, truncation', () => {
    const short = readMetaFromValue(sampleReadResult(), 40_000)
    expect(short).toEqual({ uid: '31', truncated: false })
    const capped = readMetaFromValue(
      { uid: '31', subject: 's', from: 'f@x', text: 'A'.repeat(500), truncated: false },
      100,
    )
    expect(capped).toEqual({ uid: '31', truncated: true })
  })

  it('round-trips read meta through its narrowing', () => {
    const meta = readMetaFromValue(sampleReadResult(), 40_000)
    expect(readMetaFromResult(meta)).toEqual({ uid: '31', truncated: false })
  })

  it('narrows malformed read meta to undefined instead of throwing on replay', () => {
    expect(readMetaFromResult(undefined)).toBeUndefined()
    expect(readMetaFromResult(7)).toBeUndefined()
    expect(readMetaFromResult({})).toBeUndefined()
    expect(readMetaFromResult({ uid: '1' })).toBeUndefined()
    expect(readMetaFromResult({ truncated: true })).toBeUndefined()
    expect(readMetaFromResult({ uid: 1, truncated: true })).toBeUndefined()
    expect(readMetaFromResult({ uid: '1', truncated: 'yes' })).toBeUndefined()
  })
})

describe('tool-mail registration', () => {
  it('registers both tools by default with parallel-safe execution modes', async () => {
    const { fiber, ctx } = await mountTools({ list: listProvider(sampleListResult()), read: readProvider(sampleReadResult()) })
    const names = ctx.tools.schemas().map(schema => schema.name)
    expect(names).toContain('mail_list_recent')
    expect(names).toContain('mail_read')
    expect(names).toContain('mail_codes')
    expect(ctx.tools.executionMode({ signal: testToolSignal, callId: CallId('l'), name: 'mail_list_recent', arguments: {} }))
      .toEqual({ kind: 'parallel' })
    expect(ctx.tools.executionMode({ signal: testToolSignal, callId: CallId('r'), name: 'mail_read', arguments: { uid: '1' } }))
      .toEqual({ kind: 'parallel' })
    expect(ctx.tools.executionMode({ signal: testToolSignal, callId: CallId('c'), name: 'mail_codes', arguments: {} }))
      .toEqual({ kind: 'parallel' })
    await fiber.dispose()
    expect(ctx.tools.schemas().map(schema => schema.name)).not.toContain('mail_list_recent')
  })

  it('contributes prompt sections for both tools when both are enabled', async () => {
    const { fiber, ctx } = await mountTools()
    const prompt = await ctx.systemPrompt.assemble()
    const text = prompt.sections.map(section => section.text).join('\n')
    expect(text).toContain('Use mail_list_recent to see the newest messages in the connected mailbox.')
    expect(text).toContain('Use mail_read to fetch one mailbox message in full by the id mail_list_recent returned.')
    expect(text).toContain('Use mail_codes first when you need a verification or login code from recent mail.')
    expect(text).toContain(MAIL_ACCESS_PROMPT)
    await fiber.dispose()
  })

  it('appends mailboxHint to the standing access guidance', async () => {
    const { fiber, ctx } = await mountTools({
      config: { mailboxHint: 'This process reads catchall@telepasta.ru.' },
    })
    const prompt = await ctx.systemPrompt.assemble()
    const text = prompt.sections.map(section => section.text).join('\n')
    expect(text).toContain(MAIL_ACCESS_PROMPT)
    expect(text).toContain('This process reads catchall@telepasta.ru.')
    await fiber.dispose()
  })

  it('formats standing access guidance for one, two, or three tools', () => {
    expect(mailAccessPrompt(['mail_codes'])).toContain('mail_codes is already a registered tool')
    expect(mailAccessPrompt(['mail_codes', 'mail_read'])).toContain('mail_codes and mail_read are already registered tools')
    expect(mailAccessPrompt(['mail_codes', 'mail_list_recent', 'mail_read'])).toBe(MAIL_ACCESS_PROMPT)
    expect(() => mailAccessPrompt([])).toThrow(/at least one tool name/)
  })

  it('registers only the enabled tools and adapts the guidance', async () => {
    const listOnly = await mountTools({ config: { read: false } })
    expect(listOnly.ctx.tools.schemas().map(schema => schema.name)).toContain('mail_list_recent')
    expect(listOnly.ctx.tools.schemas().map(schema => schema.name)).not.toContain('mail_read')
    const prompt = await listOnly.ctx.systemPrompt.assemble()
    const text = prompt.sections.map(section => section.text).join('\n')
    expect(text).toContain('Use mail_list_recent to see the newest messages')
    expect(text).not.toContain('Use mail_read')
    await listOnly.fiber.dispose()

    const readOnly = await mountTools({ config: { list: false } })
    expect(readOnly.ctx.tools.schemas().map(schema => schema.name)).not.toContain('mail_list_recent')
    expect(readOnly.ctx.tools.schemas().map(schema => schema.name)).toContain('mail_read')
    const readPrompt = await readOnly.ctx.systemPrompt.assemble()
    expect(readPrompt.sections.map(section => section.text).join('\n'))
      .toContain('If it reports no codes, use mail_read to inspect a message body.')
    await readOnly.fiber.dispose()

    const noCodes = await mountTools({ config: { codes: false } })
    expect(noCodes.ctx.tools.schemas().map(schema => schema.name)).not.toContain('mail_codes')
    expect(noCodes.ctx.tools.schemas().map(schema => schema.name)).toContain('mail_list_recent')
    await noCodes.fiber.dispose()

    const codesOnly = await mountTools({ config: { list: false, read: false } })
    expect(codesOnly.ctx.tools.schemas().map(schema => schema.name)).toEqual(['mail_codes'])
    const codesPrompt = await codesOnly.ctx.systemPrompt.assemble()
    const codesText = codesPrompt.sections.map(section => section.text).join('\n')
    expect(codesText).toContain('Use mail_codes first when you need a verification or login code from recent mail.')
    expect(codesText).not.toContain('mail_list_recent')
    expect(codesText).not.toContain('mail_read')
    await codesOnly.fiber.dispose()
  })
})

describe('dsh-tool-mail real-load-path guard', () => {
  it('has no default export and keeps name/inject/apply through unwrapExports', async () => {
    expect('default' in ToolMail).toBe(false)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(ToolMail) as Record<string, unknown>
    expect(unwrapped).toBe(ToolMail)
    expect(unwrapped.name).toBe('tool-mail')
    expect(unwrapped.inject).toEqual(['tools', 'mail', 'systemPrompt'])
    expect(typeof unwrapped.apply).toBe('function')

    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(MailRuntime, {})
    const plugin = loader.unwrapExports(ToolMail) as Parameters<Context['plugin']>[0]
    const fiber = await ctx.plugin(plugin)
    expect(ctx.tools.schemas().map(schema => schema.name)).toEqual(expect.arrayContaining(['mail_list_recent', 'mail_read']))
    await fiber.dispose()
  })
})

describe('tool-mail execution through the real registry', () => {
  it('executes mail_list_recent and formats the listing', async () => {
    const { fiber, call } = await mountTools({ list: listProvider(sampleListResult()) })
    const out = await call('mail_list_recent', {})
    expect(out.isError).toBe(false)
    expect(out.value).toEqual({
      messages: [
        { uid: '31', from: 'codes@svc.example', subject: 'Код', date: '2026-08-22T10:00:00.000Z' },
        { uid: '22', from: 'noreply@x.example', subject: '' },
      ],
      truncated: true,
    })
    expect(out.content.map(block => block.type === 'text' ? block.text : '').join('')).toContain('[id: 31] — Код')
    await fiber.dispose()
  })

  it('projects summaries into the result meta and derives its retrieval view', async () => {
    const { ctx, fiber, call } = await mountTools({ list: listProvider(sampleListResult()) })
    const out = await call('mail_list_recent', {})
    expect(out.meta).toEqual(listMetaFromValue(sampleListResult()))
    const view = ctx.tools.get('mail_list_recent')?.presentResult?.(
      { limit: 5 },
      { content: out.content, isError: out.isError, ...out.meta !== undefined ? { meta: out.meta } : {} },
    )
    expect(view).toMatchObject({ card: 'web', kind: 'search', title: 'Recent mail', truncated: false })
    await fiber.dispose()
  })

  it('executes mail_read and renders the bounded message text', async () => {
    const { fiber, call } = await mountTools({ read: readProvider(sampleReadResult()) })
    const out = await call('mail_read', { uid: '31' })
    expect(out.isError).toBe(false)
    expect(out.value).toEqual(sampleReadResult())
    const text = out.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(text).toContain('Message 31 — Код подтверждения')
    expect(text).toContain('551203')
    await fiber.dispose()
  })

  it('derives the read result view from the persisted meta', async () => {
    const { ctx, fiber, call } = await mountTools({ read: readProvider(sampleReadResult()) })
    const out = await call('mail_read', { uid: '31' })
    const view = ctx.tools.get('mail_read')?.presentResult?.(
      { uid: '31' },
      { content: out.content, isError: out.isError, ...out.meta !== undefined ? { meta: out.meta } : {} },
    )
    expect(view).toMatchObject({ card: 'web', kind: 'fetch', url: 'mail:31', truncated: false })
    await fiber.dispose()
  })

  it('forwards the configured cap as the seam limit and honors an explicit smaller one', async () => {
    const seen: ListSeen = {}
    const { fiber, call } = await mountTools({ list: listProvider(sampleListResult(), seen) })
    await call('mail_list_recent', {})
    expect(seen.limit).toBe(MAIL_LIST_MAX_RESULTS)
    await call('mail_list_recent', { limit: 2 })
    expect(seen.limit).toBe(2)
    await fiber.dispose()
  })

  it('forwards the caller abort signal to the seam for both tools', async () => {
    const listSeen: ListSeen = {}
    const readSeen: ReadSeen = {}
    const { ctx, fiber } = await mountTools({ list: listProvider(sampleListResult(), listSeen), read: readProvider(sampleReadResult(), readSeen) })
    const controller = new AbortController()
    await ctx.tools.execute({ callId: CallId('sig-l'), name: 'mail_list_recent', arguments: {}, signal: controller.signal })
    await ctx.tools.execute({ callId: CallId('sig-r'), name: 'mail_read', arguments: { uid: '31' }, signal: controller.signal })
    expect(listSeen.signal).toBe(controller.signal)
    expect(readSeen.signal).toBe(controller.signal)
    expect(readSeen.uid).toBe('31')
    await fiber.dispose()
  })

  it('surfaces a structured MAIL_PROVIDER_UNAVAILABLE when no provider is registered', async () => {
    const { fiber, call } = await mountTools()
    const listed = await call('mail_list_recent', {})
    expect(listed.isError).toBe(true)
    expect(listed.error?.info?.code).toBe('MAIL_PROVIDER_UNAVAILABLE')
    const read = await call('mail_read', { uid: '31' })
    expect(read.isError).toBe(true)
    expect(read.error?.info?.code).toBe('MAIL_PROVIDER_UNAVAILABLE')
    await fiber.dispose()
  })

  it('surfaces schema violations as INVALID_ARGS and validator failures as tool errors', async () => {
    const { fiber, call } = await mountTools({ list: listProvider(sampleListResult()), read: readProvider(sampleReadResult()) })
    const missingUid = await call('mail_read', {})
    expect(missingUid.isError).toBe(true)
    expect(missingUid.error?.info?.code).toBe('INVALID_ARGS')

    const badLimit = await call('mail_list_recent', { limit: 0 })
    expect(badLimit.isError).toBe(true)
    expect(badLimit.content.map(block => block.type === 'text' ? block.text : '').join('')).toContain('limit must be a positive integer')

    const blankUid = await call('mail_read', { uid: '   ' })
    expect(blankUid.isError).toBe(true)
    expect(blankUid.content.map(block => block.type === 'text' ? block.text : '').join('')).toContain('uid must be a non-empty string')
    await fiber.dispose()
  })
})

describe('mail tool budgets are plugin config', () => {
  it('attaches the default 30s budget to both tools', async () => {
    const { fiber, ctx } = await mountTools()
    expect(ctx.tools.get('mail_list_recent')?.timeoutMs).toBe(30_000)
    expect(ctx.tools.get('mail_read')?.timeoutMs).toBe(30_000)
    expect(ctx.tools.get('mail_codes')?.timeoutMs).toBe(60_000)
    await fiber.dispose()
  })

  it('honors per-tool timeout overrides from config', async () => {
    const { fiber, ctx } = await mountTools({ config: { listTimeoutMs: 60_000, readTimeoutMs: 5_000, codesTimeoutMs: 12_000 } })
    expect(ctx.tools.get('mail_list_recent')?.timeoutMs).toBe(60_000)
    expect(ctx.tools.get('mail_read')?.timeoutMs).toBe(5_000)
    expect(ctx.tools.get('mail_codes')?.timeoutMs).toBe(12_000)
    await fiber.dispose()
  })

  it('bounds the rendered mail_read output with readMaxOutputChars', async () => {
    const { fiber, call } = await mountTools({
      config: { readMaxOutputChars: 120 },
      read: readProvider({ uid: '31', subject: 's', from: 'f@x', text: 'B'.repeat(500), truncated: false }),
    })
    const out = await call('mail_read', { uid: '31' })
    expect(out.isError).toBe(false)
    const text = out.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(text.length).toBeLessThanOrEqual(120)
    expect(text).toContain('(Message truncated.')
    await fiber.dispose()
  })

  it.each([
    ['listMaxResults', { listMaxResults: 0 }],
    ['codesMaxResults', { codesMaxResults: 0 }],
    ['listTimeoutMs', { listTimeoutMs: -1 }],
    ['readTimeoutMs', { readTimeoutMs: 1.5 }],
    ['codesTimeoutMs', { codesTimeoutMs: 1.5 }],
    ['readMaxOutputChars', { readMaxOutputChars: 0 }],
  ])('rejects an unusable %s at load', async (key, config) => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(MailRuntime, {})
    await expect(ctx.plugin(ToolMail, config))
      .rejects.toThrow(new RegExp(`tool-mail: ${key} must be a positive integer`))
  })
})

describe('mail_codes formatting and presentation', () => {
  const sampleHits = {
    codes: [
      { code: '551203', uid: '31', from: 'codes@svc.example', subject: 'Код', date: '2026-08-22T10:00:00.000Z' },
      { code: '4412', uid: '22', from: 'noreply@x.example', subject: '' },
    ],
    scanned: 2,
    truncated: true,
  }

  it('renders compact code rows plus a mail_read recovery pointer', () => {
    const out = formatCodesOutput(sampleHits)
    expect(out).toContain('- 551203 from codes@svc.example [id: 31] — Код — 2026-08-22T10:00:00.000Z')
    expect(out).toContain('- 4412 from noreply@x.example [id: 22]')
    expect(out).toContain('Use mail_read with one of the ids above')
    expect(out).toContain('(More messages exist beyond the 2 scanned.)')
  })

  it('points at list and read when no codes were found', () => {
    expect(formatCodesOutput({ codes: [], scanned: 3, truncated: false }))
      .toContain('No verification codes found in the newest 3 messages.')
    expect(formatCodesOutput({ codes: [], scanned: 0, truncated: false }))
      .toContain('No verification codes found.')
    expect(formatCodesOutput({ codes: [], scanned: 0, truncated: false }))
      .toContain('Use mail_list_recent')
  })

  it('derives the completed codes card from meta', () => {
    const meta = codesMetaFromValue(sampleHits)
    expect(presentCodesResult({ limit: 5 }, toolResult(meta))).toEqual({
      card: 'web',
      kind: 'search',
      title: 'Verification codes',
      sources: [
        { url: 'mail:31', title: '551203', snippet: 'Код' },
        { url: 'mail:22', title: '4412', snippet: 'noreply@x.example' },
      ],
      truncated: false,
    })
  })

  it('falls back to the generic card for failed calls or malformed meta', () => {
    const meta = codesMetaFromValue(sampleHits)
    expect(presentCodesResult({}, toolResult(meta, 'body', true))).toBeUndefined()
    expect(presentCodesResult({}, toolResult(undefined))).toBeUndefined()
    expect(presentCodesResult({}, toolResult({ codes: 'nope' }))).toBeUndefined()
    expect(codesMetaFromResult(undefined)).toBeUndefined()
    expect(codesMetaFromResult(null)).toBeUndefined()
    expect(codesMetaFromResult([])).toBeUndefined()
    expect(codesMetaFromResult({ codes: [{ code: 1 }] })).toBeUndefined()
    expect(codesMetaFromResult({ codes: ['x'] })).toBeUndefined()
    expect(codesMetaFromResult({ codes: [null] })).toBeUndefined()
    expect(codesMetaFromResult({ codes: [[]] })).toBeUndefined()
    expect(codesMetaFromResult({ codes: [{ code: '1', uid: '1', from: 'a', subject: 'b', date: 5 }] })).toBeUndefined()
  })
})

describe('mail_codes execution through the real registry', () => {
  function mappedRead(results: Record<string, MailReadResult>, seen?: ReadSeen): MailReadProvider {
    return {
      id: 'stub-read-map',
      available: () => true,
      read: (request, signal) => {
        if (seen !== undefined) {
          seen.uid = request.uid
          seen.signal = signal
        }
        const result = results[request.uid]
        if (result === undefined) {
          return Promise.reject(new MailError(`no message ${request.uid}`, 'MAIL_UNKNOWN_MESSAGE'))
        }
        return Promise.resolve(result)
      },
    }
  }

  it('propagates non-unknown read errors', async () => {
    const { fiber, call } = await mountTools({
      list: listProvider({
        messages: [{ uid: '31', from: 'codes@svc.example', subject: 'Код' }],
        truncated: false,
      }),
      read: {
        id: 'stub-read-fail',
        available: () => true,
        read: () => Promise.reject(new MailError('imap down', 'MAIL_PROVIDER_ERROR')),
      },
    })
    const out = await call('mail_codes', {})
    expect(out.isError).toBe(true)
    expect(out.error?.info?.code).toBe('MAIL_PROVIDER_ERROR')
    await fiber.dispose()
  })

  it('omits date on a hit when the listing row is undated', async () => {
    const { fiber, call } = await mountTools({
      list: listProvider({
        messages: [{ uid: '9', from: 'a@b', subject: '' }],
        truncated: false,
      }),
      read: mappedRead({
        9: { uid: '9', subject: '', from: 'a@b', text: 'OTP 654321', truncated: false },
      }),
    })
    const out = await call('mail_codes', {})
    expect(out.isError).toBe(false)
    expect(out.value).toEqual({
      codes: [{ code: '654321', uid: '9', from: 'a@b', subject: '' }],
      scanned: 1,
      truncated: false,
    })
    await fiber.dispose()
  })

  it('derives the live codes result view from persisted meta', async () => {
    const { ctx, fiber, call } = await mountTools({
      list: listProvider({
        messages: [{ uid: '31', from: 'codes@svc.example', subject: 'Код', date: '2026-08-22T10:00:00.000Z' }],
        truncated: false,
      }),
      read: mappedRead({ 31: sampleReadResult() }),
    })
    const out = await call('mail_codes', {})
    const view = ctx.tools.get('mail_codes')?.presentResult?.(
      { limit: 5 },
      { content: out.content, isError: out.isError, ...out.meta !== undefined ? { meta: out.meta } : {} },
    )
    expect(view).toMatchObject({ card: 'web', kind: 'search', title: 'Verification codes' })
    await fiber.dispose()
  })

  it('scans newest messages and returns extracted codes', async () => {
    const { fiber, call } = await mountTools({
      list: listProvider(sampleListResult()),
      read: mappedRead({
        31: sampleReadResult(),
        22: { uid: '22', subject: '', from: 'noreply@x.example', text: 'no secrets here', truncated: false },
      }),
    })
    const out = await call('mail_codes', {})
    expect(out.isError).toBe(false)
    expect(out.value).toEqual({
      codes: [
        { code: '551203', uid: '31', from: 'codes@svc.example', subject: 'Код подтверждения', date: '2026-08-22T10:00:00.000Z' },
      ],
      scanned: 2,
      truncated: true,
    })
    const text = out.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(text).toContain('551203')
    expect(text).toContain('[id: 31]')
    await fiber.dispose()
  })

  it('skips MAIL_UNKNOWN_MESSAGE reads and still returns codes from the rest', async () => {
    const { fiber, call } = await mountTools({
      list: listProvider(sampleListResult()),
      read: mappedRead({
        31: sampleReadResult(),
      }),
    })
    const out = await call('mail_codes', {})
    expect(out.isError).toBe(false)
    expect(out.value).toMatchObject({ scanned: 2, truncated: true })
    expect((out.value as { codes: Array<{ uid: string }> }).codes).toEqual([
      expect.objectContaining({ code: '551203', uid: '31' }),
    ])
    await fiber.dispose()
  })

  it('returns an empty successful result when nothing looks like a code', async () => {
    const { fiber, call } = await mountTools({
      list: listProvider({
        messages: [{ uid: '1', from: 'a@b', subject: 'hello', date: '2026-08-22T10:00:00.000Z' }],
        truncated: false,
      }),
      read: mappedRead({
        1: { uid: '1', subject: 'hello', from: 'a@b', text: 'See you tomorrow.', truncated: false },
      }),
    })
    const out = await call('mail_codes', {})
    expect(out.isError).toBe(false)
    expect(out.value).toEqual({ codes: [], scanned: 1, truncated: false })
    const text = out.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(text).toContain('No verification codes found in the newest 1 messages.')
    expect(text).toContain('Use mail_list_recent')
    await fiber.dispose()
  })

  it('forwards the caller abort signal and honors an explicit scan limit', async () => {
    const listSeen: ListSeen = {}
    const readSeen: ReadSeen = {}
    const { ctx, fiber } = await mountTools({
      list: listProvider({
        messages: [{ uid: '31', from: 'codes@svc.example', subject: 'Код', date: '2026-08-22T10:00:00.000Z' }],
        truncated: false,
      }, listSeen),
      read: mappedRead({ 31: sampleReadResult() }, readSeen),
    })
    const controller = new AbortController()
    await ctx.tools.execute({
      callId: CallId('sig-c'),
      name: 'mail_codes',
      arguments: { limit: 4 },
      signal: controller.signal,
    })
    expect(listSeen.limit).toBe(4)
    expect(listSeen.signal).toBe(controller.signal)
    expect(readSeen.signal).toBe(controller.signal)
    await fiber.dispose()
  })
})
