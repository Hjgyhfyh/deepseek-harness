/**
 * The model-facing `mail_read` tool: retrieve one message's full decoded text
 * by the opaque id a `mail_list_recent` result supplied. This module owns its
 * schema, validation, and presentation; `ctx.mail` owns retrieval. Timeout is
 * deployment policy, not a model argument: config becomes
 * `ToolDefinition.timeoutMs`, timeout policy enforces it, and this tool
 * forwards the resulting signal.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, JsonValue, ToolResult, WebResultView } from '@deepseek-ai/dsh-tools'
import type { MailReadResult } from '@deepseek-ai/dsh-mail'
import type {} from '@deepseek-ai/dsh-system-prompt'

/**
 * Validate value constraints the schema DSL can't express: a non-blank `uid`.
 * Throws a plain `Error` otherwise. No timeout parameter — the tool-call budget
 * is deployment policy declared via `readTimeoutMs` config and enforced by
 * `@deepseek-ai/dsh-tool-call-timeout-policy`, not a model argument.
 *
 * @param args - the schema-validated `mail_read` arguments.
 * @returns the arguments as the seam's request fields.
 */
export function parseReadArgs(args: { uid: string }): { uid: string } {
  if (args.uid.trim().length === 0) throw new Error('uid must be a non-empty string')
  return { uid: args.uid }
}

/**
 * Format a read result as one model-facing text block, bounded as a whole.
 *
 * @param result - the seam's read outcome.
 * @param maxOutputChars - cap on the complete returned string; a cut body gets
 *   the same fetch-something-narrower notice as provider-side truncation.
 * @returns the complete `Message <uid>`-headed text and whether the provider,
 *   a source cut, or the cap trimmed the content.
 */
export function formatReadOutput(result: MailReadResult, maxOutputChars: number): RenderedRead {
  const header = `Message ${result.uid} — ${result.subject || '(no subject)'}\nFrom: ${result.from}\n\n`
  const prefix = `${header}${result.text}`
  const truncated = result.truncated || prefix.length > maxOutputChars
  const footer = '\n\n(Message truncated. Ask for a narrower excerpt or check the sender for the full text.)'
  if (prefix.length <= maxOutputChars) {
    return { text: truncated ? `${prefix}${footer}` : prefix, truncated }
  }
  if (maxOutputChars <= footer.length) {
    return { text: prefix.slice(0, maxOutputChars), truncated }
  }
  return { text: `${prefix.slice(0, maxOutputChars - footer.length)}${footer}`, truncated }
}

/** A rendered read output: the model-facing text and its effective truncation. */
export interface RenderedRead {
  /** The complete bounded output — header, body text, and truncation footer. */
  text: string
  /** True when the provider capped the body or the output cap trimmed it. */
  truncated: boolean
}

/**
 * Pending-call presentation: a fetch card titled by the message id.
 *
 * @param args - the raw tool arguments; only `uid` feeds the view.
 * @returns the generic card view (`kind: 'fetch'`) shown while the call runs.
 */
export function presentReadCall(args: { uid: string }): GenericCallView {
  return { card: 'generic', title: args.uid, kind: 'fetch', rawInput: args.uid }
}

/**
 * The `mail_read` tool's private `tool/result` `meta` payload: the read
 * summary a UI cannot recover from the model-facing render text without
 * reparsing its header lines. Attached opaquely (as `JsonValue`) on the tool
 * result and persisted with the session log, so `presentResult` reproduces the
 * retrieval card on replay. `truncated` is the effective truncation the render
 * text reflects, which a client cannot recompute (it does not know the
 * deployment's `readMaxOutputChars`); this is why meta is carried, not derived
 * from the header line.
 */
export interface MailReadMeta {
  /** The id exactly as listed. */
  uid: string
  /** True when the provider or the output cap trimmed the content. */
  truncated: boolean
}

/**
 * Project a validated `mail_read` output value into its replayable
 * presentation meta ({@link MailReadMeta} as opaque JSON). `truncated` is the
 * effective truncation the model-facing text reflects (via
 * {@link formatReadOutput}), not the provider-only
 * `MailReadResult.truncated`, so the card never disagrees with the returned text.
 *
 * @param value - the canonical `mail_read` output value (the seam's result shape).
 * @param maxOutputChars - the deployment's output cap, the same one
 *   {@link formatReadOutput} applies to the render text.
 * @returns the id and effective truncation flag.
 */
export function readMetaFromValue(value: MailReadResult, maxOutputChars: number): JsonValue {
  return { uid: value.uid, truncated: formatReadOutput(value, maxOutputChars).truncated }
}

/**
 * Narrow opaque live or replayed result metadata to a {@link MailReadMeta}.
 * Malformed metadata returns `undefined` so presentation can fall back to the
 * generic card instead of throwing during replay.
 *
 * @param meta - result metadata.
 * @returns the validated read meta, or `undefined` for absent or malformed data.
 */
export function readMetaFromResult(meta: unknown): MailReadMeta | undefined {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const { uid, truncated } = meta as Record<string, unknown>
  if (typeof uid !== 'string' || typeof truncated !== 'boolean') return undefined
  return { uid, truncated }
}

/**
 * Completed-call presentation: a `web`-family retrieval card carrying the read
 * summary from `meta`. It sets no `content` copy — a UI without the card falls
 * back to the raw `tool/result` content, the already-decoded body text.
 *
 * @param args - the raw tool arguments; `uid` becomes the result-state title so
 *   a window-truncated replay that dropped the call head still has one.
 * @param result - the final model-facing tool result; `meta` carries the summary.
 * @returns the retrieval result view, or `undefined` (generic card) on failure
 *   or malformed meta.
 */
export function presentReadResult(args: { uid: string }, result: ToolResult): WebResultView | undefined {
  if (result.isError) return undefined
  const meta = readMetaFromResult(result.meta)
  if (meta === undefined) return undefined
  return {
    card: 'web',
    kind: 'fetch',
    title: args.uid,
    url: `mail:${meta.uid}`,
    statusCode: 200,
    truncated: meta.truncated,
  }
}

/**
 * Register the `mail_read` tool and its system-prompt guidance.
 *
 * @param ctx - context whose `tools` and `systemPrompt` registries receive the
 *   registrations; both are effect-scoped and unregister on plugin dispose.
 * @param timeoutMs - the cooperative tool-call budget (ms) attached as the tool's
 *   `ToolDefinition.timeoutMs` for `@deepseek-ai/dsh-tool-call-timeout-policy` to enforce.
 * @param maxOutputChars - cap on the complete rendered tool output (see
 *   {@link formatReadOutput}).
 */
export function applyMailReadTool(ctx: Context, timeoutMs: number, maxOutputChars: number): void {
  ctx.systemPrompt.section({
    name: 'tool:mail_read',
    order: 113,
    text: 'Use mail_read to fetch one mailbox message in full by the id mail_list_recent returned. It returns headers plus the decoded body text — use it when the list preview does not show the code or detail you need.',
  })

  ctx.tools.register(defineTool({
    name: 'mail_read',
    description: 'Read one mailbox message in full by its id, returning headers and the decoded body text.',
    parameters: {
      uid: { type: 'string', required: true, description: 'The message id from mail_list_recent.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          uid: { type: 'string', required: true },
          subject: { type: 'string', required: true },
          from: { type: 'string', required: true },
          text: { type: 'string', required: true },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatReadOutput(value, maxOutputChars).text }],
      presentationMeta: (_args, value) => readMetaFromValue(value, maxOutputChars),
    },
    timeoutMs,
    // Mailbox reads do not mutate parent-agent state.
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const input = parseReadArgs(args)
      const result = await ctx.mail.read(
        { uid: input.uid },
        exec.signal,
      )
      return result
    },
    presentCall: presentReadCall,
    presentResult: (args, result) => presentReadResult(args, result),
  }))
}
