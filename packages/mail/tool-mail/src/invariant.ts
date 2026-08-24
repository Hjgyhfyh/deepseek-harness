/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-tool-mail`.
 * @module @deepseek-ai/dsh-tool-mail/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-tool-mail'

/** Cordis companion plugin name. */
export const name = 'tool-mail-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the tools are effect-scoped registry entries owned by
 * `ctx.tools`, and every model-visible byte rides the existing `tool/call` /
 * `tool/result` events, so the package owns no independent durable state.
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
