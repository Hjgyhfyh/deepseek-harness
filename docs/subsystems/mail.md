# Mailbox Access

English | [中文](mail.zh.md)

The mailbox access seam — a [capability seam](../../.agents/notes/implemented/architecture/2026-08-22-mail-capability-seam.md) that spans **two operations** (list and read) on one `ctx.mail` service, split across packages: Service Definition ([dsh-mail](../../packages/mail/mail), `ctx.mail` + the provider registries), Service Providers ([dsh-mail-imap](../../packages/mail/mail-imap)), and Consumer ([dsh-tool-mail](../../packages/mail/tool-mail), the `mail_codes` / `mail_list_recent` / `mail_read` tool schemas). Mail is **one optional capability**, not part of the agent-loop spine — so its vocabulary lives here, not in [core.md](core.md). A provider swap does not change how the model asks for recent mail, for one message's full text, or for a compact codes scan. `mail_codes` is a consumer projection over list+read: a miss is an empty success that points the model at `mail_list_recent` and `mail_read`, not a second mailbox backend.

Source: [`packages/mail/mail/src/types.ts`](../../packages/mail/mail/src/types.ts)

## Why one capability has two operations

Listing and reading share no request schema and no business logic, but they are deliberately one `ctx.mail` middle layer: one provider-selection policy owner, one abort/error vocabulary, and one product-facing "how this harness reaches its mail" configuration API. The cost is the parallel `list`/`read` method pairs on the service; that parallelism is intentional, not a missed extraction. Providers register **capabilities** (a `MailListProvider` or `MailReadProvider`), not tools; the model-facing names, schemas, prompt guidance, and presentation all live in the single `dsh-tool-mail` consumer.

## List request and result

The model-facing tool argument is at most a `limit`; `maxResults`-style bounds are consumer-owned (`dsh-tool-mail`'s `listMaxResults` config, default `10`) and enforced on the way back — if a provider over-returns, the seam keeps the newest `limit` messages and sets `truncated`.

```ts type-equiv
/**
 * What one list-capable backend is asked to return. The request carries no
 * folder: a provider serves its configured mailbox (the deployment's account).
 */
interface MailListRequest {
  /** Upper bound on returned messages; the newest `limit` win. */
  readonly limit: number
}
```

```ts type-equiv
/**
 * One listed message: enough metadata to pick a message to read without any
 * body transfer. `uid` is opaque to consumers — round-trip it into
 * {@link MailReadRequest.uid}; only the issuing provider interprets it.
 */
interface MailMessageSummary {
  /** Opaque provider message id, stable within one provider instance. */
  readonly uid: string
  /** `From` header value as received (usually `"Name" <addr>`). */
  readonly from: string
  /** Subject as received; an absent header reads as the empty string. */
  readonly subject: string
  /** Message date as an ISO-8601 UTC string, or omitted when undated. */
  readonly date?: string
}
```

## Read request and result

```ts type-equiv
/** What one read-capable backend is asked to retrieve. */
interface MailReadRequest {
  /** The opaque id exactly as a prior list result supplied it. */
  readonly uid: string
}
```

A read never flips mailbox flags: providers fetch with `BODY.PEEK` semantics, so an agent reading mail leaves `\Seen` untouched.

The provider owns MIME decoding. A `multipart/*` body splits on its declared boundary and each top-level part is parsed into headers plus payload; the best text part wins (`text/plain` over `text/html`), with transfer encoding and charset decoded per part. A nested multipart surfaces as one opaque part whose raw text is the fallback, so an unrecognized structure degrades to readable text rather than to an empty result. A singlepart body has no part headers: its content type and transfer encoding ride the message-level headers. HTML-only bodies are stripped to readable text.

```ts type-equiv
/**
 * Normalized read outcome. `text` is the decoded body text of the first
 * non-empty text part (`text/plain` preferred over `text/html`), already
 * bounded by the provider's character cap. A successful read of an empty body
 * is a result with empty `text`, not an error.
 */
interface MailReadResult {
  readonly uid: string
  readonly subject: string
  readonly from: string
  /** Decoded body text; empty when the message carries none. */
  readonly text: string
  /** True when the provider cut the decoded text at its character cap. */
  readonly truncated: boolean
}
```

## Provider availability

A provider's `available(): boolean` is a cheap LOCAL check (credential reference resolvable, parseable config) and **must not make network calls**. It is an input to execution-time selection, not a health system: `list()`/`read()` read it to pick a usable provider, and a selection failure surfaces as the structured `MailError` the caller routes on — which carries the branchable detail (the missing id or ambiguous candidate set) in its code and message.

Selection never depends on registration, config, or HMR order: a capability has an explicit provider id (config `listProvider`/`readProvider`, or the matching env var feeding the same field), or auto-selects when exactly one usable provider is registered; multiple usable providers with no configured id is `MAIL_PROVIDER_AMBIGUOUS`, not first-wins.

## Errors

`MailError extends HarnessError` ([core.md](core.md) error taxonomy) with a `code: string` (open, like every other seam's error — `LlmError`, `WebError`), not a closed union: a provider may raise its own codes without editing `dsh-mail`, and consumers must tolerate an unknown code. The codes split by owner. Seam-neutral codes are raised by the shared `MailRuntime` contract: `MAIL_PROVIDER_UNAVAILABLE`, `MAIL_PROVIDER_CONFIGURED_MISSING`, `MAIL_PROVIDER_CONFIGURED_UNAVAILABLE`, `MAIL_PROVIDER_AMBIGUOUS`, `MAIL_DUPLICATE_PROVIDER` (a registration-time programming error, the analogue of `LlmRuntime`'s `DUPLICATE_ADAPTER`), `MAIL_ABORTED`, `MAIL_UNKNOWN_MESSAGE`, `MAIL_CREDENTIAL_MISSING`, and `MAIL_PROVIDER_ERROR` (the catch-all for a provider's own failure surfaced through the seam, including network/transport failure — DNS, connection refused, TLS).

## Credentials

Configuration never carries a password: `dsh-mail-imap` takes `passwordEnv`, a credential reference resolved per connection through the credential seam (`ctx.credentials`). A missing credential fails each operation with `MAIL_CREDENTIAL_MISSING` rather than silently degrading.

## The service

`MailRuntime` registers list and read providers, rejects duplicate ids with `MAIL_DUPLICATE_PROVIDER`, and resolves providers at execution time with structured selection errors. The IMAP backend opens one short-lived connection per operation, logs in through the credential seam, SELECTs the configured mailbox, and runs `BODY.PEEK` fetches only.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->
<!-- END GENERATED cordis-surface -->
