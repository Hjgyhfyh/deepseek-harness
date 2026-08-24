/**
 * Service Definition for the mailbox capability seam (`ctx.mail`): registries and
 * provider-selecting execution for listing recent messages and reading one in full.
 * Duplicate ids are rejected. At execution time, a configured provider must exist and
 * be usable; without one, exactly one usable provider is required, so selection never
 * depends on registration order.
 * @module @deepseek-ai/dsh-mail
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {
  MailListProvider,
  MailListRequest,
  MailListResult,
  MailReadProvider,
  MailReadRequest,
  MailReadResult,
} from './types.ts'
import { MailError } from './types.ts'

export {
  MailError,
} from './types.ts'
export type {
  MailListProvider,
  MailListRequest,
  MailListResult,
  MailMessageSummary,
  MailReadProvider,
  MailReadRequest,
  MailReadResult,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    mail: MailRuntime
  }
}

/** Selection inputs for execution-time provider resolution. */
interface Selection<P> {
  /** The configured provider id for this capability, if any. */
  readonly configuredId?: string
  /** Providers registered for this capability kind. */
  readonly providers: ReadonlyMap<string, P>
}

/**
 * Config for the mail seam. `listProvider` / `readProvider` pin which provider
 * wins for each capability; both are optional (a single registered usable
 * provider auto-selects). Operational overrides such as environment variables
 * must feed these same fields rather than introduce a hidden priority chain.
 */
export interface MailRuntimeConfig {
  /** Explicit list provider id. Omitted = auto-select when exactly one usable. */
  readonly listProvider?: string
  /** Explicit read provider id. Omitted = auto-select when exactly one usable. */
  readonly readProvider?: string
}

/**
 * The mailbox access service. Registered as `ctx.mail` (one instance per context).
 *
 * Selection semantics (resolved at execution time, never order-dependent):
 * - A configured id that is registered and `available()` → that provider.
 * - A configured id not registered → `MAIL_PROVIDER_CONFIGURED_MISSING`.
 * - A configured id registered but unavailable →
 *   `MAIL_PROVIDER_CONFIGURED_UNAVAILABLE`.
 * - No id configured, exactly one registered usable provider → that provider.
 * - No id configured, multiple usable providers → `MAIL_PROVIDER_AMBIGUOUS`.
 * - No id configured, no usable provider → `MAIL_PROVIDER_UNAVAILABLE`.
 */
export class MailRuntime extends Service {
  /**
   * Provider selection config. Operational env overrides feed the SAME fields:
   * `$DSH_MAIL_LIST_PROVIDER` / `$DSH_MAIL_READ_PROVIDER` are equivalent to
   * `listProvider` / `readProvider` and are NOT a hidden priority chain.
   */
  static Config: z<MailRuntimeConfig> = z.object({
    listProvider: z.string(),
    readProvider: z.string(),
  })

  private listProviders = new Map<string, MailListProvider>()
  private readProviders = new Map<string, MailReadProvider>()
  private readonly listProviderId: string | undefined
  private readonly readProviderId: string | undefined

  constructor(ctx: Context, config: MailRuntimeConfig = {}) {
    super(ctx, 'mail')
    this.listProviderId = config.listProvider ?? process.env.DSH_MAIL_LIST_PROVIDER
    this.readProviderId = config.readProvider ?? process.env.DSH_MAIL_READ_PROVIDER
  }

  /**
   * Register a list provider. Throws {@link MailError} `MAIL_DUPLICATE_PROVIDER`
   * if its id is already registered for list. Returns a disposer; disposed with
   * the calling fiber.
   * @param provider - the provider; its `id` is the registry key.
   * @returns the disposer that unregisters the provider.
   */
  registerListProvider(provider: MailListProvider): () => void {
    return this.registerProvider(this.listProviders, provider)
  }

  /**
   * Register a read provider. Throws {@link MailError} `MAIL_DUPLICATE_PROVIDER`
   * if its id is already registered for read. Returns a disposer; disposed with
   * the calling fiber.
   * @param provider - the provider; its `id` is the registry key.
   * @returns the disposer that unregisters the provider.
   */
  registerReadProvider(provider: MailReadProvider): () => void {
    return this.registerProvider(this.readProviders, provider)
  }

  private registerProvider<P extends { readonly id: string }>(store: Map<string, P>, provider: P): () => void {
    if (store.has(provider.id)) {
      throw new MailError(`a mail provider with id "${provider.id}" is already registered`, 'MAIL_DUPLICATE_PROVIDER')
    }
    const dispose = this.ctx.effect(function* () {
      store.set(provider.id, provider)
      yield () => store.delete(provider.id)
    }, 'mail.registerProvider()')
    // ctx.effect's disposer returns Promise<void>; our disposer API is
    // synchronous fire-and-forget — discard the (always-resolved) promise.
    return () => void dispose()
  }

  /**
   * List recent messages through the selected provider. Resolves the provider at
   * call time with the selection rules above; throws {@link MailError} when the
   * capability cannot run. The seam enforces `request.limit` on the result: if
   * the provider over-returns, `messages[]` keeps the newest `limit` and
   * `truncated` set.
   * @param request - the listing bound.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the newest messages first, capped to `request.limit`.
   */
  async list(request: MailListRequest, signal?: AbortSignal): Promise<MailListResult> {
    const provider = resolveProvider({
      providers: this.listProviders,
      ...this.listProviderId !== undefined ? { configuredId: this.listProviderId } : {},
    })
    const result = await provider.list(request, signal)
    return capMessages(result, request.limit)
  }

  /**
   * Read one message through the selected provider. Resolves the provider at
   * call time with the selection rules above; throws {@link MailError} when the
   * capability cannot run or no message carries the requested id.
   * @param request - the opaque id from a prior listing.
   * @param signal - optional cancellation signal forwarded to the provider.
   * @returns the decoded message.
   */
  async read(request: MailReadRequest, signal?: AbortSignal): Promise<MailReadResult> {
    const provider = resolveProvider({
      providers: this.readProviders,
      ...this.readProviderId !== undefined ? { configuredId: this.readProviderId } : {},
    })
    return provider.read(request, signal)
  }
}

interface ResolvableProvider {
  readonly id: string
  available(): boolean
}

/** Resolve the selected provider or throw the matching {@link MailError}. */
function resolveProvider<P extends ResolvableProvider>(selection: Selection<P>): P {
  const { configuredId, providers } = selection
  if (configuredId !== undefined) {
    const provider = providers.get(configuredId)
    if (!provider) {
      throw new MailError(`configured mail provider "${configuredId}" is not registered`, 'MAIL_PROVIDER_CONFIGURED_MISSING')
    }
    if (!provider.available()) {
      throw new MailError(`configured mail provider "${configuredId}" is registered but unavailable`, 'MAIL_PROVIDER_CONFIGURED_UNAVAILABLE')
    }
    return provider
  }
  const usable = [...providers.values()].filter(provider => provider.available())
  const [single] = usable
  if (single === undefined) {
    throw new MailError('no usable mail provider is registered', 'MAIL_PROVIDER_UNAVAILABLE')
  }
  if (usable.length > 1) {
    const ids = usable.map(provider => provider.id).join(', ')
    throw new MailError(`multiple usable mail providers are registered (${ids}); configure one explicitly`, 'MAIL_PROVIDER_AMBIGUOUS')
  }
  return single
}

/** Enforce `limit` on a list result: keep the newest `limit` and flag it. */
function capMessages(result: MailListResult, limit: number | undefined): MailListResult {
  if (limit === undefined || result.messages.length <= limit) return result
  return { ...result, messages: result.messages.slice(0, limit), truncated: true }
}

export default MailRuntime
