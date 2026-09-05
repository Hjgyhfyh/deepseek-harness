/**
 * `@deepseek-ai/dsh-mail-imap`: registers the IMAP `MailListProvider` /
 * `MailReadProvider` pair with `ctx.mail`. A function/namespace plugin (NOT a
 * default-export service): it registers INTO the seam's registries, like web
 * providers register into theirs. Credentials ride the credential seam —
 * configuration carries only the reference.
 *
 * @module @deepseek-ai/dsh-mail-imap
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-mail'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { ImapProviderOptions } from './provider.ts'
import { ImapMailProvider } from './provider.ts'

export {
  IMAP_LIST_PROVIDER_ID,
  IMAP_READ_PROVIDER_ID,
  ImapMailProvider,
} from './provider.ts'
export type { ImapProviderOptions } from './provider.ts'
export { ImapClient } from './client.ts'
export type { CommandOptions, FetchedMessage, ImapConnectionOptions, NextLine } from './client.ts'
export {
  charsetOf,
  decodeEncodedWords,
  decodeText,
  decodeTransferEncoding,
  headerValue,
  parseHeaders,
  pickBodyText,
  unfoldHeaders,
} from './mime.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'mail-imap'

/** The mail seam this provider registers into. */
export const inject = ['mail']

const DEFAULT_PORT_SECURE = 993
const DEFAULT_PORT_PLAIN = 143
const DEFAULT_MAILBOX = 'INBOX'
const DEFAULT_MAX_SCAN = 50
const DEFAULT_MAX_BODY_CHARS = 20_000
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Plugin config: server coordinates, mailbox, limits, and the credential
 * reference. All defaulted except the host and the password reference, which a
 * deployment must state (misconfiguration fails loud at load).
 */
export interface Config {
  /** IMAP server hostname (e.g. `telepasta.ru`). */
  host: string
  /** IMAP server port; defaults to 993 when `secure`, else 143. */
  port?: number
  /** Implicit TLS on connect; defaults to true. */
  secure?: boolean
  /** Login user; defaults to {@link host} when omitted (set the address explicitly). */
  user?: string
  /** Credential reference carrying the login password. Required. */
  passwordEnv: string
  /** Mailbox to SELECT before every operation; defaults to `INBOX`. */
  mailbox?: string
  /**
   * Newest-message scan window per list; bounds the FETCH fan-out on a busy
   * mailbox. Defaults to 50.
   */
  maxScan?: number
  /** Per-read character cap on decoded body text. Defaults to 20000. */
  maxBodyChars?: number
  /** Per-operation connect+command timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number
  /**
   * When set, list only messages newer than this many hours. Undefined lists
   * the newest messages unconditionally.
   */
  sinceHours?: number
}

export const Config: z<Config> = z.object({
  host: z.string().required(),
  port: z.natural(),
  secure: z.boolean().default(true),
  user: z.string(),
  passwordEnv: z.string().role('credential-ref').required(),
  mailbox: z.string().default(DEFAULT_MAILBOX),
  maxScan: z.number().step(1).min(1).default(DEFAULT_MAX_SCAN),
  maxBodyChars: z.number().step(1).min(1).default(DEFAULT_MAX_BODY_CHARS),
  timeoutMs: z.number().step(1).min(1).default(DEFAULT_TIMEOUT_MS),
  sinceHours: z.number().step(1).min(0),
})

/** Settings namespace carrying this provider's server coordinates and limits. */
export const MAIL_IMAP_SETTINGS_NAMESPACE = settingsNamespace('mail-imap')

/** Complete config after schemastery applies every field default. */
type ResolvedConfig = Required<Omit<Config, 'port' | 'user' | 'sinceHours'>>

/**
 * Project one resolved section into provider options. The password resolver
 * rides the credential seam per operation; without that seam the ambient
 * launch environment is the whole credential plane.
 */
function resolveOptions(ctx: Context, config: ResolvedConfig & Partial<Config>): ImapProviderOptions {
  const passwordEnv = credentialRef(config.passwordEnv)
  const port = config.port ?? (config.secure ? DEFAULT_PORT_SECURE : DEFAULT_PORT_PLAIN)
  return {
    ...config.sinceHours !== undefined ? { sinceHours: config.sinceHours } : {},
    host: config.host,
    port,
    secure: config.secure,
    ...(config.user !== undefined && config.user.length > 0 ? { user: config.user } : {}),
    passwordEnv,
    resolvePassword: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(passwordEnv))?.value
      const ambient = launchEnvironmentOf(ctx).get(passwordEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    mailbox: config.mailbox,
    maxScan: config.maxScan,
    maxBodyChars: config.maxBodyChars,
    timeoutMs: config.timeoutMs,
  }
}

/** Register the IMAP provider pair with `ctx.mail`. */
export function apply(ctx: Context, config: Config): void {
  if (config.host.trim().length === 0) {
    throw new Error('mail-imap: host must be a non-empty string')
  }
  if (config.passwordEnv.trim().length === 0) {
    throw new Error('mail-imap: passwordEnv must be a non-empty string')
  }
  let current: () => Config = () => config
  installSettingsSection(ctx, MAIL_IMAP_SETTINGS_NAMESPACE, Config, config, {
    setSource: (source) => {
      current = source
    },
    // The registration carries no resolved value: the provider projects the
    // section per operation, so a committed change needs no re-registration.
    onChange: () => {},
  })
  ctx.mail.registerListProvider(new ImapMailProvider(() => resolveOptions(ctx, current() as ResolvedConfig & Partial<Config>)))
  ctx.mail.registerReadProvider(new ImapMailProvider(() => resolveOptions(ctx, current() as ResolvedConfig & Partial<Config>)))
}
