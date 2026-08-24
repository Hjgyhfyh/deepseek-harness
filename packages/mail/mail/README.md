# @deepseek-ai/dsh-mail

English | [中文](README.zh.md)

The **`MailRuntime`** (`ctx.mail`) defines WHAT mailbox access the harness has — list recent messages, read one message in full — over multiple providers, without binding the model contract to one backend's protocol.

This package owns the Service Definition role of the mail capability. Like web it spans two operations (list and read) on one seam, with potentially multiple providers each:

| Package | Role |
|---|---|
| `@deepseek-ai/dsh-mail` (this) | Service Definition: the service, provider registries, selection policy, request/result vocabulary, the `MailError` taxonomy |
| `@deepseek-ai/dsh-mail-imap` | Provider: IMAP `LIST`/`FETCH` against a configured account |
| `@deepseek-ai/dsh-tool-mail` | Consumer: the model-facing `mail_codes` / `mail_list_recent` / `mail_read` tool schemas over `ctx.mail` |

List and read share no request schema and no business logic, but they are deliberately one seam: `ctx.mail` is a single mailbox-access middle layer with one provider-selection policy owner, one abort/error vocabulary, and one product-facing "how this harness reaches its mail" config surface. The `List`/`Read` method pairs are deliberately parallel.

## Service API (`ctx.mail`)

| Member | Semantics |
|---|---|
| `registerListProvider(provider)` / `registerReadProvider(provider)` | Register a backend. Throws `MailError` `MAIL_DUPLICATE_PROVIDER` on a duplicate id within that capability kind. Returns a disposer. Disposed with the calling fiber. |
| `list(request, signal?)` | Resolve the list provider and run one listing. Enforces `request.limit` on the result (keeps the newest `limit`, sets `truncated`). Throws `MailError` when the capability cannot run. |
| `read(request, signal?)` | Resolve the read provider and retrieve one message. Throws `MailError` for failures to safely retrieve or represent the message and when no message carries the requested id. |

Providers register **capabilities**, not tools. `dsh-tool-mail` is the only owner of model-facing names, descriptions, prompt guidance, JSON schemas, and presentation.

## Selection

Selection never depends on registration, config, or HMR order. A capability has an explicit provider id (config `listProvider`/`readProvider`, or env `$DSH_MAIL_LIST_PROVIDER`/`$DSH_MAIL_READ_PROVIDER` feeding the same fields), or auto-selects when exactly one usable provider is registered. `list()`/`read()` resolve the provider at execution time:

| Situation | Execution |
|---|---|
| configured id registered and `available()` | runs that provider |
| configured id not registered | `MAIL_PROVIDER_CONFIGURED_MISSING` |
| configured id registered but unavailable | `MAIL_PROVIDER_CONFIGURED_UNAVAILABLE` |
| no id, exactly one registered usable provider | runs it |
| no id, no usable provider | `MAIL_PROVIDER_UNAVAILABLE` |
| no id, multiple usable providers | `MAIL_PROVIDER_AMBIGUOUS` |

The failure branches throw `MailError`, whose structured code (plus message detail — the missing id, the ambiguous candidate set) direct callers route on. A provider's own `available()` is a cheap local check (credential presence, parseable config) that feeds this execution-time selection and **must not make network calls**; `dsh-tool-mail` never calls it — the tool executes through `ctx.mail.list()`/`read()` and routes on the thrown codes, so provider selection has one owner.

## Vocabulary

`MailListRequest` (`limit`) → `MailListResult` (`messages[]`, `truncated`); each `MailMessageSummary` carries an opaque `uid`, `from`, `subject`, and optional ISO-8601 `date`. `MailReadRequest` (`uid`) → `MailReadResult` (`uid`, `subject`, `from`, decoded `text`, `truncated`); cancellation is a direct optional `AbortSignal` argument to `list()`/`read()`. The read result's `truncated` reports the provider's character cap on the body, not the list cap. See `src/types.ts` for the full contracts and the `MailError` code taxonomy.

## Model Experience

Indirectly, through `dsh-tool-mail`, which retains bounded normalized provider data or the exact configured-provider, unavailable-provider, no-provider, multiple-provider, unknown-id, and `Error: <message>` failures while this registry contributes no prompt or schema itself.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

- **No observation surface** — no provider-change event and no capability-status query; availability is observed only by executing `list()`/`read()` and routing the thrown `MailError` codes, mirroring the web seam's dropped observation surface.
- **No folder or mailbox selection** — a provider serves its configured account; per-request folder switching is deferred until a second consumer needs it.
- **No send/search capability** — this seam is read-only; sending mail would be a separate operation with its own abuse surface.
