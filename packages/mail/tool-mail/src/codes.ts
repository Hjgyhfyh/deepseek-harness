/**
 * The model-facing `mail_codes` tool: scan newest messages and return compact
 * verification-code rows. Execution goes through `ctx.mail` list then read;
 * this module owns schema, extraction, formatting, and presentation. A miss is
 * a successful empty result that points at `mail_list_recent` / `mail_read`.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, JsonValue, ToolResult, WebResultView } from '@deepseek-ai/dsh-tools'
import { MailError } from '@deepseek-ai/dsh-mail'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { parseListArgs } from './list.ts'
import { extractVerificationCodes } from './extract.ts'

/** One extracted code plus the message it came from. */
export interface MailCodeHit {
  /** The extracted verification code. */
  code: string
  /** Opaque message id, round-trippable into `mail_read`. */
  uid: string
  /** `From` header as received. */
  from: string
  /** Subject as received; empty when the header is absent. */
  subject: string
  /** Message date as an ISO-8601 UTC string, omitted when undated. */
  date?: string
}

/** Canonical `mail_codes` output value. */
export interface MailCodesResult {
  /** Extracted codes in mailbox-then-run order. */
  codes: MailCodeHit[]
  /** How many newest messages were opened. */
  scanned: number
  /** True when the listing said more messages exist beyond `scanned`. */
  truncated: boolean
}

/**
 * Format a codes scan as one model-facing text block.
 *
 * @param result - the scan outcome.
 * @returns compact code rows, or an empty-mailbox recovery pointer.
 */
export function formatCodesOutput(result: MailCodesResult): string {
  const parts: string[] = []
  if (result.codes.length > 0) {
    parts.push(`Verification codes:\n${result.codes.map(formatHit).join('\n')}`)
    parts.push('Use mail_read with one of the ids above if a code looks wrong or is missing.')
  } else if (result.scanned === 0) {
    parts.push('No verification codes found. Use mail_list_recent to see recent mail and mail_read to inspect a message\'s full text.')
  } else {
    parts.push(`No verification codes found in the newest ${result.scanned} messages. Use mail_list_recent to see recent mail and mail_read to inspect a message's full text.`)
  }
  if (result.truncated) {
    parts.push(`(More messages exist beyond the ${result.scanned} scanned.)`)
  }
  return parts.join('\n\n')
}

/** One compact row: code, sender, opaque id, optional subject and date. */
function formatHit(hit: MailCodeHit): string {
  const meta: string[] = []
  if (hit.subject.length > 0) meta.push(hit.subject)
  if (hit.date !== undefined) meta.push(hit.date)
  const suffix = meta.length > 0 ? ` — ${meta.join(' — ')}` : ''
  return `- ${hit.code} from ${hit.from} [id: ${hit.uid}]${suffix}`
}

/**
 * Pending-call presentation: a fetch card titled by the request.
 *
 * @param args - the raw tool arguments.
 * @returns the generic card view (`kind: 'fetch'`) shown while the call runs.
 */
export function presentCodesCall(args: { limit?: number }): GenericCallView {
  return { card: 'generic', title: 'Listing verification codes', kind: 'fetch', rawInput: args }
}

/**
 * The `mail_codes` tool's private `tool/result` `meta` payload: structured hits
 * a UI cannot recover from the render text without reparsing it.
 */
export interface MailCodesMeta {
  /** The faithful structured hits, mailbox order then encounter order. */
  codes: MailCodeHit[]
}

/**
 * Project a validated `mail_codes` output value into its replayable
 * presentation meta ({@link MailCodesMeta} as opaque JSON).
 *
 * @param value - the canonical output value.
 * @returns the structured hits.
 */
export function codesMetaFromValue(value: MailCodesResult): JsonValue {
  return {
    codes: value.codes.map(hit => ({
      code: hit.code,
      uid: hit.uid,
      from: hit.from,
      subject: hit.subject,
      ...hit.date !== undefined ? { date: hit.date } : {},
    })),
  }
}

/** Whether `value` is a valid hit (defensive narrowing from opaque `meta`). */
function isHit(value: unknown): value is MailCodeHit {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const { code, uid, from, subject, date } = value as Record<string, unknown>
  return typeof code === 'string' && typeof uid === 'string' && typeof from === 'string'
    && typeof subject === 'string' && (date === undefined || typeof date === 'string')
}

/**
 * Narrow opaque live or replayed result metadata to a {@link MailCodesMeta}.
 * Malformed metadata returns `undefined` so presentation can fall back to the
 * generic card instead of throwing during replay.
 *
 * @param meta - result metadata.
 * @returns the validated codes meta, or `undefined` for absent or malformed data.
 */
export function codesMetaFromResult(meta: unknown): MailCodesMeta | undefined {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const { codes } = meta as Record<string, unknown>
  if (!Array.isArray(codes) || !codes.every(isHit)) return undefined
  return { codes }
}

/**
 * Completed-call presentation: a `web`-family retrieval card carrying the
 * structured hits from `meta`.
 *
 * @param _args - the raw tool arguments (unused; the title stays pending-state).
 * @param result - the final model-facing tool result; `meta` carries hits.
 * @returns the retrieval result view, or `undefined` (generic card) on failure
 *   or malformed meta.
 */
export function presentCodesResult(_args: { limit?: number }, result: ToolResult): WebResultView | undefined {
  if (result.isError) return undefined
  const meta = codesMetaFromResult(result.meta)
  if (meta === undefined) return undefined
  return {
    card: 'web',
    kind: 'search',
    title: 'Verification codes',
    sources: meta.codes.map(hit => ({
      url: `mail:${hit.uid}`,
      title: hit.code,
      snippet: hit.subject.length > 0 ? hit.subject : hit.from,
    })),
    truncated: false,
  }
}

/** Prompt text adapted to which recovery tools the same composition exposes. */
function codesPrompt(listEnabled: boolean, readEnabled: boolean): string {
  const intro = 'Use mail_codes first when you need a verification or login code from recent mail. It scans newest messages and returns compact code/from/subject rows.'
  if (listEnabled && readEnabled) {
    return `${intro} If it reports no codes, use mail_list_recent and mail_read to inspect the decoded body yourself.`
  }
  if (listEnabled) {
    return `${intro} If it reports no codes, use mail_list_recent to inspect recent mail.`
  }
  if (readEnabled) {
    return `${intro} If it reports no codes, use mail_read to inspect a message body.`
  }
  return intro
}

/** True when a read failed because that id is no longer in the mailbox. */
function isUnknownMessage(error: unknown): boolean {
  return error instanceof MailError && error.code === 'MAIL_UNKNOWN_MESSAGE'
}

/**
 * Register the `mail_codes` tool and its system-prompt guidance.
 *
 * @param ctx - context whose `tools` and `systemPrompt` registries receive the
 *   registrations; both are effect-scoped and unregister on plugin dispose.
 * @param maxResults - the deployment's scan cap, sent as the list request `limit`.
 * @param timeoutMs - the cooperative tool-call budget (ms) attached as the tool's
 *   `ToolDefinition.timeoutMs` for `@deepseek-ai/dsh-tool-call-timeout-policy` to enforce.
 * @param listEnabled - whether the same composition exposes `mail_list_recent`.
 * @param readEnabled - whether the same composition exposes `mail_read`.
 */
export function applyMailCodesTool(
  ctx: Context,
  maxResults: number,
  timeoutMs: number,
  listEnabled: boolean,
  readEnabled: boolean,
): void {
  ctx.systemPrompt.section({
    name: 'tool:mail_codes',
    order: 111,
    text: codesPrompt(listEnabled, readEnabled),
  })

  ctx.tools.register(defineTool({
    name: 'mail_codes',
    description: 'Scan newest mailbox messages for verification or login codes and return compact code, sender, subject, and id rows.',
    parameters: {
      limit: { type: 'integer', description: `How many newest messages to scan (1-${maxResults}). Omit for the default.` },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          codes: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                code: { type: 'string', required: true },
                uid: { type: 'string', required: true },
                from: { type: 'string', required: true },
                subject: { type: 'string', required: true },
                date: { type: 'string' },
              },
            },
          },
          scanned: { type: 'integer', required: true },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatCodesOutput(value) }],
      presentationMeta: (_args, value) => codesMetaFromValue(value),
    },
    timeoutMs,
    // Mailbox reads do not mutate parent-agent state.
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const input = parseListArgs(args)
      const listed = await ctx.mail.list(
        { limit: input.limit ?? maxResults },
        exec.signal,
      )
      const codes: MailCodeHit[] = []
      for (const summary of listed.messages) {
        exec.signal.throwIfAborted()
        let text: string
        let subject: string
        let from: string
        let uid: string
        try {
          const read = await ctx.mail.read({ uid: summary.uid }, exec.signal)
          text = read.text
          subject = read.subject
          from = read.from
          uid = read.uid
        } catch (error) {
          if (isUnknownMessage(error)) continue
          throw error
        }
        for (const code of extractVerificationCodes(`${subject}\n${text}`)) {
          codes.push({
            code,
            uid,
            from,
            subject,
            ...summary.date !== undefined ? { date: summary.date } : {},
          })
        }
      }
      return { codes, scanned: listed.messages.length, truncated: listed.truncated }
    },
    presentCall: presentCodesCall,
    presentResult: (args, result) => presentCodesResult(args, result),
  }))
}
