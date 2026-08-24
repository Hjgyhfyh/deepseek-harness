# Agent Note: Mailbox access is a capability seam with list and read tools

Status: implemented

English | [中文](2026-08-22-mail-capability-seam.zh.md)

## Problem

Agents operate accounts that confirm through one-time codes mailed to a private-domain mailbox on a VPS (here: `@telepasta.ru`). An external channel already exists — a Telegram bot that parses codes and pushes them — but the harness agent itself had no mail access. When the external parser misses a code, mangles it, or the agent needs context the parser dropped, the agent is stuck: it cannot see what actually arrived.

Two distinct reads are needed, and they have different shapes. Scanning what recently arrived is a metadata question — senders, subjects, dates, cheap and repeatable. Recovering a code the preview did not show is a body question — one message, full decoded text. Binding the model contract to one mail server's wire protocol, or to one parser's output, would repeat the mistake the [web seam](2026-06-24-web-capability-seam.md) already avoided for search and fetch.

## Decision

Mailbox access is a first-class capability seam following [the capability-seam Agent Note](2026-06-13-capability-seams.md), with the same three roles as web:

1. `@deepseek-ai/dsh-mail` (`packages/mail/mail`) owns `ctx.mail`, the list and read provider registries, execution-time provider selection, the shared request/result vocabulary, and `MailError`.
2. `@deepseek-ai/dsh-mail-imap` (`packages/mail/mail-imap`) registers one provider under both capabilities. Each operation opens one short-lived IMAP connection: SELECT the configured mailbox, run one `BODY.PEEK` fetch, close. Decoding of the fetched `BODY[TEXT]` is MIME-aware: a multipart body splits on its declared boundary, the best text leaf wins (`text/plain` preferred over `text/html`), and transfer encodings plus charsets decode per part. Login resolves `passwordEnv` through the credential seam on every operation — configuration carries the reference, never a value. Reading never flips `\Seen`.
3. `@deepseek-ai/dsh-tool-mail` (`packages/mail/tool-mail`) owns the model-facing `mail_codes`, `mail_list_recent`, and `mail_read` tool schemas, prompt guidance, limits, and presentation.

Providers register capabilities; the consumer owns model-facing names and schemas. Tools stay registered regardless of provider state — an enabled tool whose provider is unconfigured fails at execution time with a structured `MailError` (`MAIL_PROVIDER_UNAVAILABLE`, `MAIL_CREDENTIAL_MISSING`, …), so misconfiguration surfaces as a routable error, not a missing schema.

The two-step flow is deliberate. `mail_list_recent` fetches headers only and returns sender, subject, date, and an opaque id; `mail_read` transfers one decoded body on demand, bounded by a character cap. The seam enforces the listing bound on the way back, like `ctx.web` enforces `maxResults`.

`mail_codes` is a consumer projection over that same list+read path: it opens the newest messages, extracts likely verification codes, and returns compact rows. A miss is a successful empty result that tells the model to use `mail_list_recent` and `mail_read` — the extractor is not a second mailbox and must not hide recovery. The external Telegram-bot parser stays useful as a push channel.

The base bundle in this tree enables `mail-imap` against `mail.telepasta.ru` / `catchall@telepasta.ru` and sets `tool-mail.mailboxHint`. The password still resolves from `passwordEnv` (`MAIL_IMAP_PASSWORD`) and never enters YAML. `mail_codes`, `mail_list_recent`, and `mail_read` stay registered on the parent and on every in-process child (BotForge employees inherit them; the deny list is only delegation tools). A standing prompt tells the model to call those tools and not to grep the workspace or spawn Telegram to read mail.

```text
@deepseek-ai/dsh-tool-mail  --depends on-->  @deepseek-ai/dsh-mail  <--depends on--  @deepseek-ai/dsh-mail-imap
        consumer                                 interface                       implementation
```

## Alternatives considered

### Let the IMAP provider register its own tools

Rejected for the same reason the web seam rejected provider-owned tools: tool names, descriptions, and schemas would depend on which provider packages load, and swapping the backend (IMAP to a mail-provider API) would change the model contract. `dsh-tool-mail` is the single owner of model-facing text.

### Ship a code-extraction parser as a second mailbox backend

Rejected: a second IMAP/Telegram parser would hide misses ("no code found") and couple the model contract to one parser's output. What shipped instead is a consumer projection over decoded list+read text. Empty output must point at `mail_list_recent` / `mail_read` so a regex miss is recoverable. Keyword-adjacent digit and mixed tokens will still miss unusual senders; that is acceptable because recovery stays on the same seam.

### One tool that returns full bodies for the newest messages

Rejected: bodies are the expensive part. A listing that transfers N full bodies floods context with signatures, disclaimers, and HTML boilerplate to answer a metadata question. The two-tool split keeps scanning cheap and makes body cost an explicit per-message decision.

### POP3

Rejected: POP3 has no server-side UID-stable fetch model comparable to IMAP UIDs, no mailbox selection, and weaker partial-fetch semantics; the header-only listing that makes the two-step flow cheap depends on `BODY.PEEK[HEADER.FIELDS …]`. IMAP is also what self-hosted mailservers (Dovecot and friends) expose by default.

## Consequences

- The mail vocabulary is provider-neutral: a future backend (a mail-provider API, a local Maildir) registers under `ctx.mail` without touching tool schemas, mirroring the web seam's provider swaps.
- Reading mail never marks it seen, so an agent and a human mail client can share the mailbox without hiding mail from each other.
- Credentials resolve per operation, so rotating the mailbox password reaches the next call without a restart.
- A missing IMAP password fails each call with `MAIL_CREDENTIAL_MISSING`; the tools stay in the schema so the model can see them. In-process children inherit the same tools.
- The IMAP client is a minimal purpose-built implementation (tagged commands, literals, FETCH sections) — not a full RFC 3501 client. Commands outside SELECT/LOGIN/FETCH/LOGOUT semantics, STARTTLS, and IDLE are out of scope; the seam's needs are bounded by the list, read, and codes tools.
