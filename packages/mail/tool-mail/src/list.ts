/**
 * The model-facing `mail_list_recent` tool: list the newest messages in the
 * deployment's mailbox. Execution goes through `ctx.mail` — this module owns
 * only the model-facing schema, argument validation, the result-count bound,
 * and result formatting, never provider selection or network access.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, JsonValue, ToolResult, WebResultView } from '@deepseek-ai/dsh-tools'
import type { MailListResult, MailMessageSummary } from '@deepseek-ai/dsh-mail'
import type {} from '@deepseek-ai/dsh-system-prompt'

/**
 * Default upper bound on returned messages (the `listMaxResults` config).
 * Owned by the consumer (not the provider or model), mirroring
 * `dsh-tool-web`'s `WEB_SEARCH_MAX_RESULTS`. The model just asks for recent
 * mail; the product controls how much context returns.
 */
export const MAIL_LIST_MAX_RESULTS = 10

/**
 * Validate value constraints the schema DSL can't express: a non-blank
 * `query`. Throws a plain `Error` otherwise. (No free-text argument exists
 * today; the validator keeps parity with sibling tools' parse functions.)
 *
 * @param args - the schema-validated `mail_list_recent` arguments.
 * @returns the accepted arguments, passed through unchanged.
 */
export function parseListArgs(args: { limit?: number }): { limit?: number } {
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('limit must be a positive integer')
  }
  return args
}

/** One row of the rendered listing: sender, subject, date, and the opaque id. */
function formatSummary(message: MailMessageSummary): string {
  const parts = [`- ${message.from}`]
  const meta: string[] = []
  if (message.subject.length > 0) meta.push(message.subject)
  if (message.date !== undefined) meta.push(message.date)
  const suffix = meta.length > 0 ? ` — ${meta.join(' — ')}` : ''
  parts.push(`[id: ${message.uid}]${suffix}`)
  return parts.join(' ')
}

/**
 * Format a listing as one model-facing text block.
 *
 * @param result - the seam's listing outcome.
 * @returns the markdown message list (or `No messages found.`), a
 *   read-one-with-mail_read pointer, and a more-exist note when truncated.
 */
export function formatListOutput(result: MailListResult): string {
  const parts: string[] = []
  if (result.messages.length > 0) {
    parts.push(`Recent messages:\n${result.messages.map(formatSummary).join('\n')}`)
    parts.push('Use mail_read with one of the ids above to see its full text.')
  } else {
    parts.push('No messages found.')
  }
  if (result.truncated) {
    if (result.messages.length === 0) {
      parts.push('(The mailbox has messages outside this listing window.)')
    } else {
      parts.push(`(More messages exist beyond the ${result.messages.length} shown.)`)
    }
  }
  return parts.join('\n\n')
}

/**
 * Pending-call presentation: a fetch card titled by the request.
 *
 * @param args - the raw tool arguments.
 * @returns the generic card view (`kind: 'fetch'`) shown while the call runs.
 */
export function presentListCall(args: { limit?: number }): GenericCallView {
  return { card: 'generic', title: 'Listing recent mail', kind: 'fetch', rawInput: args }
}

/**
 * The `mail_list_recent` tool's private `tool/result` `meta` payload: the
 * structured summaries a UI cannot recover from the render text without
 * reparsing it. Attached opaquely (as `JsonValue`) on the tool result and
 * persisted with the session log, so `presentResult` reproduces the web-style
 * retrieval card on replay.
 */
export interface MailListMeta {
  /** The faithful structured summaries, newest first. */
  messages: Array<{ uid: string; from: string; subject: string; date?: string }>
}

/**
 * Project a validated `mail_list_recent` output value into its replayable
 * presentation meta ({@link MailListMeta} as opaque JSON).
 *
 * @param value - the canonical output value (the seam's result shape).
 * @returns the structured summaries.
 */
export function listMetaFromValue(value: MailListResult): JsonValue {
  return {
    messages: value.messages.map(message => ({
      uid: message.uid,
      from: message.from,
      subject: message.subject,
      ...message.date !== undefined ? { date: message.date } : {},
    })),
  }
}

/** Whether `value` is a valid summary (defensive narrowing from opaque `meta`). */
function isSummary(value: unknown): value is { uid: string; from: string; subject: string; date?: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const { uid, from, subject, date } = value as Record<string, unknown>
  return typeof uid === 'string' && typeof from === 'string' && typeof subject === 'string'
    && (date === undefined || typeof date === 'string')
}

/**
 * Narrow opaque live or replayed result metadata to a {@link MailListMeta}.
 * Malformed metadata returns `undefined` so presentation can fall back to the
 * generic card instead of throwing during replay.
 *
 * @param meta - result metadata.
 * @returns the validated list meta, or `undefined` for absent or malformed data.
 */
export function listMetaFromResult(meta: unknown): MailListMeta | undefined {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const { messages } = meta as Record<string, unknown>
  if (!Array.isArray(messages) || !messages.every(isSummary)) return undefined
  return { messages }
}

/**
 * Completed-call presentation: a `web`-family retrieval card carrying the
 * structured summaries from `meta`. It sets no `content` copy — a UI without
 * the card falls back to the raw `tool/result` content, which is the same text.
 *
 * @param _args - the raw tool arguments (unused; the title stays pending-state).
 * @param result - the final model-facing tool result; `meta` carries summaries.
 * @returns the retrieval result view, or `undefined` (generic card) on failure
 *   or malformed meta.
 */
export function presentListResult(_args: { limit?: number }, result: ToolResult): WebResultView | undefined {
  if (result.isError) return undefined
  const meta = listMetaFromResult(result.meta)
  if (meta === undefined) return undefined
  return {
    card: 'web',
    kind: 'search',
    title: 'Recent mail',
    sources: meta.messages.map(message => ({
      url: `mail:${message.uid}`,
      title: message.subject.length > 0 ? message.subject : message.from,
      ...message.date !== undefined && message.date.length > 0 ? { snippet: message.date } : {},
    })),
    truncated: false,
  }
}

/**
 * Register the `mail_list_recent` tool and its system-prompt guidance.
 *
 * @param ctx - context whose `tools` and `systemPrompt` registries receive the
 *   registrations; both are effect-scoped and unregister on plugin dispose.
 * @param maxResults - the deployment's message cap, sent as every seam
 *   request's `limit`.
 * @param timeoutMs - the cooperative tool-call budget (ms) attached as the tool's
 *   `ToolDefinition.timeoutMs` for `@deepseek-ai/dsh-tool-call-timeout-policy` to enforce.
 * @param readEnabled - whether the same composition exposes `mail_read`, which
 *   controls whether guidance may recommend that follow-up tool.
 */
export function applyMailListTool(ctx: Context, maxResults: number, timeoutMs: number, readEnabled: boolean): void {
  ctx.systemPrompt.section({
    name: 'tool:mail_list_recent',
    order: 112,
    text: readEnabled
      ? 'Use mail_list_recent to see the newest messages in the connected mailbox. It returns senders, subjects, dates, and opaque message ids. Use mail_read with an id when you need the full body of one message.'
      : 'Use mail_list_recent to see the newest messages in the connected mailbox. It returns senders, subjects, dates, and opaque message ids.',
  })

  ctx.tools.register(defineTool({
    name: 'mail_list_recent',
    description: 'List the newest messages in the connected mailbox with sender, subject, date, and an id usable by mail_read.',
    parameters: {
      limit: { type: 'integer', description: `How many newest messages to return (1-${maxResults}). Omit for the default.` },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          messages: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                uid: { type: 'string', required: true },
                from: { type: 'string', required: true },
                subject: { type: 'string', required: true },
                date: { type: 'string' },
              },
            },
          },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatListOutput(value) }],
      presentationMeta: (_args, value) => listMetaFromValue(value),
    },
    timeoutMs,
    // Mailbox reads do not mutate parent-agent state.
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const input = parseListArgs(args)
      const result = await ctx.mail.list(
        { limit: input.limit ?? maxResults },
        exec.signal,
      )
      return projectSummaries(result)
    },
    presentCall: presentListCall,
    presentResult: (args, result) => presentListResult(args, result),
  }))
}

/** Project a validated list result into the canonical output shape. */
function projectSummaries(result: MailListResult): {
  messages: Array<{ uid: string; from: string; subject: string; date?: string }>
  truncated: boolean
} {
  return {
    messages: result.messages.map(message => ({
      uid: message.uid,
      from: message.from,
      subject: message.subject,
      ...message.date !== undefined ? { date: message.date } : {},
    })),
    truncated: result.truncated,
  }
}
