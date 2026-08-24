/**
 * Model-facing `mail_codes`, `mail_list_recent`, and `mail_read` tools over
 * `ctx.mail`. This package owns schemas, validation, prompt guidance, limits,
 * and presentation, never concrete providers. Enablement controls tool
 * registration; an enabled tool remains visible when its provider is
 * unavailable and fails with a structured error at execution time.
 * @module @deepseek-ai/dsh-tool-mail
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-mail'
import { applyMailCodesTool } from './codes.ts'
import { applyMailListTool, MAIL_LIST_MAX_RESULTS } from './list.ts'
import { applyMailReadTool } from './read.ts'

export { extractVerificationCodes } from './extract.ts'
export {
  applyMailCodesTool,
  codesMetaFromResult,
  codesMetaFromValue,
  formatCodesOutput,
  presentCodesCall,
  presentCodesResult,
} from './codes.ts'
export type { MailCodeHit, MailCodesMeta, MailCodesResult } from './codes.ts'
export {
  MAIL_LIST_MAX_RESULTS,
  applyMailListTool,
  formatListOutput,
  listMetaFromResult,
  listMetaFromValue,
  parseListArgs,
  presentListCall,
  presentListResult,
} from './list.ts'
export type { MailListMeta } from './list.ts'
export {
  applyMailReadTool,
  formatReadOutput,
  parseReadArgs,
  presentReadCall,
  presentReadResult,
  readMetaFromResult,
  readMetaFromValue,
} from './read.ts'
export type { MailReadMeta, RenderedRead } from './read.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-mail'

/** Services required by the mail tool suite. */
export const inject = ['tools', 'mail', 'systemPrompt']

/** Default cooperative tool-call timeout budget (ms) for the mail tools. */
export const DEFAULT_MAIL_TOOL_TIMEOUT_MS = 30_000

/**
 * Default cooperative timeout budget (ms) for `mail_codes`. Higher than the
 * single-op tools because one call lists then reads up to `codesMaxResults`
 * messages.
 */
export const DEFAULT_CODES_TOOL_TIMEOUT_MS = 60_000

/**
 * Default cap on one `mail_read` output. Bounded well above typical
 * verification mails while keeping a full body from flooding context.
 */
export const DEFAULT_READ_MAX_OUTPUT_CHARS = 40_000

/**
 * Standing mailbox-access guidance for the currently enabled mail tools.
 *
 * @param names - enabled mail tool names, in display order. Must be non-empty.
 * @returns the prompt section body.
 */
export function mailAccessPrompt(names: readonly string[]): string {
  if (names.length === 0) {
    throw new Error('tool-mail: mailAccessPrompt requires at least one tool name')
  }
  const listed = names.length === 1
    ? names[0]!
    : names.length === 2
      ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]!}`
  const plural = names.length !== 1
  return `${listed} ${plural ? 'are already registered tools' : 'is already a registered tool'} on this agent and on every in-process child (including BotForge employees). Call ${plural ? 'them' : 'it'} directly to read this process's mailbox. Do not grep or glob the workspace for ${plural ? 'those names' : 'that name'}. Do not spawn Telegram or another agent to read mail.`
}

/** Default standing guidance when every mail tool is enabled. */
export const MAIL_ACCESS_PROMPT = mailAccessPrompt(['mail_codes', 'mail_list_recent', 'mail_read'])

/** Plugin config: which mail tools to register, caps, and per-tool budgets. */
export interface Config {
  /** Register `mail_list_recent`. Defaults to true. */
  list?: boolean
  /** Register `mail_read`. Defaults to true. */
  read?: boolean
  /** Register `mail_codes`. Defaults to true. */
  codes?: boolean
  /** Upper bound on messages returned by one `mail_list_recent` call. */
  listMaxResults?: number
  /** Upper bound on messages scanned by one `mail_codes` call. */
  codesMaxResults?: number
  /** Cooperative timeout budget (ms) for `mail_list_recent`. Defaults to 30000. */
  listTimeoutMs?: number
  /** Cooperative timeout budget (ms) for `mail_read`. Defaults to 30000. */
  readTimeoutMs?: number
  /** Cooperative timeout budget (ms) for `mail_codes`. Defaults to 60000. */
  codesTimeoutMs?: number
  /** Cap on the complete `mail_read` output characters. Defaults to 40000. */
  readMaxOutputChars?: number
  /**
   * Optional deployment identity appended to {@link MAIL_ACCESS_PROMPT}
   * (for example which mailbox this process reads). Empty by default.
   */
  mailboxHint?: string
}

export const Config: z<Config> = z.object({
  list: z.boolean().default(true),
  read: z.boolean().default(true),
  codes: z.boolean().default(true),
  listMaxResults: z.number().default(MAIL_LIST_MAX_RESULTS),
  codesMaxResults: z.number().default(MAIL_LIST_MAX_RESULTS),
  listTimeoutMs: z.number().default(DEFAULT_MAIL_TOOL_TIMEOUT_MS),
  readTimeoutMs: z.number().default(DEFAULT_MAIL_TOOL_TIMEOUT_MS),
  codesTimeoutMs: z.number().default(DEFAULT_CODES_TOOL_TIMEOUT_MS),
  readMaxOutputChars: z.number().default(DEFAULT_READ_MAX_OUTPUT_CHARS),
  mailboxHint: z.string().default(''),
})

/** Complete config after schemastery applies every field default. */
type ResolvedConfig = Required<Config>

/** Configured count, timeout, and character caps must be positive integers. */
function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`tool-mail: ${name} must be a positive integer`)
  }
}

/**
 * Register the enabled mail tools. `list`/`read`/`codes` default to true; a
 * product that wants a subset disables the others in config. Each tool's
 * cooperative timeout budget is resolved here and attached as
 * `ToolDefinition.timeoutMs` for `@deepseek-ai/dsh-tool-call-timeout-policy`
 * to enforce. The tools' disposers are fiber-scoped (the effect-based
 * registries clean up on dispose), so no manual teardown is needed.
 */
export function apply(ctx: Context, config: Config): void {
  // schemastery (Config) has already filled every defaulted field.
  const resolved = config as ResolvedConfig
  assertPositiveInteger('listMaxResults', resolved.listMaxResults)
  assertPositiveInteger('codesMaxResults', resolved.codesMaxResults)
  assertPositiveInteger('listTimeoutMs', resolved.listTimeoutMs)
  assertPositiveInteger('readTimeoutMs', resolved.readTimeoutMs)
  assertPositiveInteger('codesTimeoutMs', resolved.codesTimeoutMs)
  assertPositiveInteger('readMaxOutputChars', resolved.readMaxOutputChars)
  const enabledNames = [
    ...resolved.codes ? ['mail_codes'] as const : [],
    ...resolved.list ? ['mail_list_recent'] as const : [],
    ...resolved.read ? ['mail_read'] as const : [],
  ]
  if (enabledNames.length > 0) {
    applyMailboxAccessPrompt(ctx, enabledNames, resolved.mailboxHint)
  }
  if (resolved.codes) {
    applyMailCodesTool(
      ctx,
      resolved.codesMaxResults,
      resolved.codesTimeoutMs,
      resolved.list,
      resolved.read,
    )
  }
  if (resolved.list) {
    applyMailListTool(ctx, resolved.listMaxResults, resolved.listTimeoutMs, resolved.read)
  }
  if (resolved.read) applyMailReadTool(ctx, resolved.readTimeoutMs, resolved.readMaxOutputChars)
}

/**
 * Register the standing mailbox-access prompt.
 *
 * @param ctx - context whose `systemPrompt` registry receives the section.
 * @param names - enabled mail tool names, in display order.
 * @param hint - optional deployment identity appended after the standing text.
 */
function applyMailboxAccessPrompt(ctx: Context, names: readonly string[], hint: string): void {
  const trimmed = hint.trim()
  const body = mailAccessPrompt(names)
  ctx.systemPrompt.section({
    name: 'tool:mail',
    order: 110,
    text: trimmed.length === 0 ? body : `${body} ${trimmed}`,
  })
}
