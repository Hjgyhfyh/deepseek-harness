/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-botforge`.
 * @module @deepseek-ai/dsh-botforge/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-botforge'

/** Cordis companion plugin name. */
export const name = 'botforge-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: roster and orchestrator settings live in the host
 * settings document, and `delegate_employee` writes only through the existing
 * subagent session events. The plugin owns no durable session event type and
 * no cross-plugin mutable relation beyond the settings namespaces it registers.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
