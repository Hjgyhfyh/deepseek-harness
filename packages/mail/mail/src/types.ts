/**
 * Vocabulary for the mailbox capability seam (`ctx.mail`). Listing and reading
 * deliberately share one seam so provider selection, cancellation, errors, and
 * product configuration have one owner, while retaining separate request and
 * result types.
 * @module @deepseek-ai/dsh-mail/types
 */

import { HarnessError } from '@deepseek-ai/dsh-llm'

/**
 * What one list-capable backend is asked to return. The request carries no
 * folder: a provider serves its configured mailbox (the deployment's account).
 */
export interface MailListRequest {
  /** Upper bound on returned messages; the newest `limit` win. */
  readonly limit: number
}

/**
 * Normalized listing outcome. `messages[]` is ordered newest-first and capped
 * to the request's `limit`. `truncated` reports that more messages exist in
 * the mailbox beyond the cap; it does not mean this provider cut anything.
 */
export interface MailListResult {
  readonly messages: readonly MailMessageSummary[]
  readonly truncated: boolean
}

/**
 * One listed message: enough metadata to pick a message to read without any
 * body transfer. `uid` is opaque to consumers — round-trip it into
 * {@link MailReadRequest.uid}; only the issuing provider interprets it.
 */
export interface MailMessageSummary {
  /** Opaque provider message id, stable within one provider instance. */
  readonly uid: string
  /** `From` header value as received (usually `"Name" <addr>`). */
  readonly from: string
  /** Subject as received; an absent header reads as the empty string. */
  readonly subject: string
  /** Message date as an ISO-8601 UTC string, or omitted when undated. */
  readonly date?: string
}

/** What one read-capable backend is asked to retrieve. */
export interface MailReadRequest {
  /** The opaque id exactly as a prior list result supplied it. */
  readonly uid: string
}

/**
 * Normalized read outcome. `text` is the decoded body text of the first
 * non-empty text part (`text/plain` preferred over `text/html`), already
 * bounded by the provider's character cap. A successful read of an empty body
 * is a result with empty `text`, not an error.
 */
export interface MailReadResult {
  readonly uid: string
  readonly subject: string
  readonly from: string
  /** Decoded body text; empty when the message carries none. */
  readonly text: string
  /** True when the provider cut the decoded text at its character cap. */
  readonly truncated: boolean
}

/**
 * A list-capable backend. Registered with `ctx.mail.registerListProvider`.
 * `id` is a stable string, unique within the list capability kind.
 */
export interface MailListProvider {
  readonly id: string
  /** Cheap local usability check; must not make network calls. */
  available(): boolean
  /** Run one listing; honor `signal` for cancellation. */
  list(request: MailListRequest, signal?: AbortSignal): Promise<MailListResult>
}

/**
 * A read-capable backend. Registered with `ctx.mail.registerReadProvider`.
 * `id` is a stable string, unique within the read capability kind.
 */
export interface MailReadProvider {
  readonly id: string
  /** Cheap local usability check; must not make network calls. */
  available(): boolean
  /** Retrieve one message; honor `signal` for cancellation. */
  read(request: MailReadRequest, signal?: AbortSignal): Promise<MailReadResult>
}

/**
 * Typed mail error with a machine-routable, open-string `code` and chained
 * `cause`. Consumers must tolerate provider-specific codes. Shared codes cover
 * unavailable, missing, ambiguous, or duplicate providers, cancellation, an
 * unknown read id, and provider failure.
 */
export class MailError extends HarnessError {}
