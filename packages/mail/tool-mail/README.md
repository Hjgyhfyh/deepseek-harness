# @deepseek-ai/dsh-tool-mail

English | [中文](README.zh.md)

The **Consumer** role of the mail capability seam: the model-facing `mail_codes`, `mail_list_recent`, and `mail_read` tools over `ctx.mail`. This package owns schemas, validation, prompt guidance, limits, and presentation — never concrete providers.

| Package | Role |
|---|---|
| `@deepseek-ai/dsh-mail` | Service Definition: `ctx.mail`, selection, vocabulary |
| `@deepseek-ai/dsh-mail-imap` | Provider: IMAP backend |
| `@deepseek-ai/dsh-tool-mail` (this) | Consumer: tool schemas over `ctx.mail` |

## Tools

### `mail_codes`

Scans the newest messages and returns compact verification-code rows (code, sender, subject, id). One optional argument:

- `limit` (integer) — how many newest messages to open; bounded by `codesMaxResults` (default 10).

Use this first when the task is a login or confirmation code. A miss is a successful empty result that tells the model to fall back to `mail_list_recent` and `mail_read` — the extractor is a consumer projection, not a second mailbox.

### `mail_list_recent`

Lists the newest messages in the deployment's mailbox. One optional argument:

- `limit` (integer) — how many newest messages to return; bounded by the deployment's `listMaxResults` (default 10).

Returns sender, subject, date (when present), and an opaque message id per row, plus a `truncated` flag when more messages exist beyond the cap. The id is the only handle the model gets; it round-trips into `mail_read`.

### `mail_read`

Reads one message in full by its id. One required argument:

- `uid` (string) — an id exactly as a prior listing supplied it.

Returns headers (`subject`, `from`) plus the decoded body text, capped by `readMaxOutputChars` (default 40000). The two-step flow is deliberate: listings stay cheap and bodies transfer only on demand — the model scans previews first, then reads precisely one message when a preview does not show what it needs.

## Config

| Field | Meaning | Default |
|---|---|---|
| `list` | Register `mail_list_recent` | `true` |
| `read` | Register `mail_read` | `true` |
| `codes` | Register `mail_codes` | `true` |
| `listMaxResults` | Cap on listed messages | 10 |
| `codesMaxResults` | Cap on messages `mail_codes` opens | 10 |
| `listTimeoutMs` | Cooperative budget for `mail_list_recent` | 30000 |
| `readTimeoutMs` | Cooperative budget for `mail_read` | 30000 |
| `codesTimeoutMs` | Cooperative budget for `mail_codes` | 60000 |
| `readMaxOutputChars` | Cap on complete `mail_read` output | 40000 |
| `mailboxHint` | Optional deployment identity appended to the standing mailbox-access prompt | `''` |

Enablement controls registration only: an enabled tool stays visible when no provider is usable and fails at execution time with the structured `MAIL_*` error codes. In-process children (spawn, fork, BotForge employees) inherit these tools; the standing prompt says to call them and not to grep the workspace or spawn Telegram to read mail.

## Model Experience

### System prompt

#### What the model sees

Each enabled tool contributes one independently registered prompt section, plus one standing mailbox-access section that lists the enabled tool names and tells the model to call them (not grep, not Telegram). `mail_codes` chooses its recovery sentence from whether `mail_list_recent` and `mail_read` are also config-enabled. A scoped tool restriction does not remove these sections.

##### Standing mailbox-access guidance (all three tools enabled)

```markdown
mail_codes, mail_list_recent, and mail_read are already registered tools on this agent and on every in-process child (including BotForge employees). Call them directly to read this process's mailbox. Do not grep or glob the workspace for those names. Do not spawn Telegram or another agent to read mail.
```

`mailboxHint`, when non-empty after trim, is appended to that paragraph.

##### Codes guidance with list and read enabled

```markdown
Use mail_codes first when you need a verification or login code from recent mail. It scans newest messages and returns compact code/from/subject rows. If it reports no codes, use mail_list_recent and mail_read to inspect the decoded body yourself.
```

##### Codes guidance with list only

```markdown
Use mail_codes first when you need a verification or login code from recent mail. It scans newest messages and returns compact code/from/subject rows. If it reports no codes, use mail_list_recent to inspect recent mail.
```

##### Codes guidance with read only

```markdown
Use mail_codes first when you need a verification or login code from recent mail. It scans newest messages and returns compact code/from/subject rows. If it reports no codes, use mail_read to inspect a message body.
```

##### Codes guidance with neither recovery tool

```markdown
Use mail_codes first when you need a verification or login code from recent mail. It scans newest messages and returns compact code/from/subject rows.
```

##### List guidance with read enabled

```markdown
Use mail_list_recent to see the newest messages in the connected mailbox. It returns senders, subjects, dates, and opaque message ids. Use mail_read with an id when you need the full body of one message.
```

##### List-only guidance

```markdown
Use mail_list_recent to see the newest messages in the connected mailbox. It returns senders, subjects, dates, and opaque message ids.
```

##### Read guidance

```markdown
Use mail_read to fetch one mailbox message in full by the id mail_list_recent returned. It returns headers plus the decoded body text — use it when the list preview does not show the code or detail you need.
```

#### Token effect

Fixed guidance cost per request for each config-enabled tool plus one standing mailbox-access section, even when a restriction hides a schema. Toggling `list`, `read`, or `codes` rewrites that standing sentence and, for `mail_codes`, the recovery sentence.

#### KV Cache effect

Prefix-stable while enabled tools, scope, and guidance text are unchanged. Config enablement—including toggling list or read, which rewrites the codes guidance—or plugin lifecycle may invalidate reuse from the first changed prompt section; scoped schema restrictions do not remove it.

### Tool schemas

#### What the model sees

The model sees the generated [`mail_codes`, `mail_list_recent`, and `mail_read` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-mail). Scan/list caps and timeout budgets are deployment settings, not model arguments.

#### Token effect

Fixed schema cost per request; config disablement removes both schema and guidance, while a scoped restriction removes only the schema.

#### KV Cache effect

Prefix-stable while definitions and visibility are unchanged. Config enablement, plugin lifecycle, or scoped restrictions may invalidate reuse from the first changed schema token.

### Codes result

#### What the model sees

Hits render as `Verification codes:` followed by lines shaped `- <code> from <from> [id: <uid>]`, optionally suffixed ` — <subject> — <date>`, then `Use mail_read with one of the ids above if a code looks wrong or is missing.` An empty scan of N messages says `No verification codes found in the newest <N> messages. Use mail_list_recent to see recent mail and mail_read to inspect a message's full text.`; a scan of zero messages drops the count. A truncated mailbox adds `(More messages exist beyond the <N> scanned.)`.

#### Token effect

Data-dependent rows are resent until compaction and the scan window is capped by `codesMaxResults`.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### List result

#### What the model sees

A non-empty listing is `Recent messages:` followed by lines shaped `- <from> [id: <uid>]`, optionally suffixed ` — <subject> — <date>`, then `Use mail_read with one of the ids above to see its full text.` An empty mailbox says `No messages found.` A truncated listing adds `(More messages exist beyond the <N> shown.)`.

#### Token effect

Data-dependent rows are resent until compaction and the listing is capped by `listMaxResults`.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Read result

#### What the model sees

A successful read is `Message <uid> — <subject-or-(no subject)>`, a `From: <from>` line, a blank line, and the decoded body. Truncation adds a blank line and `(Message truncated. Ask for a narrower excerpt or check the sender for the full text.)`; failures become `Error: <message>`. Message ids remain in call history.

#### Token effect

`readMaxOutputChars` bounds the complete output; retained call arguments and results are resent until compaction, and timeout policy can replace a late result with a short error.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Argument errors

#### What the model sees

A blank `uid` becomes exactly `Error: uid must be a non-empty string`. A non-positive `limit` becomes exactly `Error: limit must be a positive integer`.

#### Token effect

Only the failing call adds these retained tokens.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

## Known Limitations and Deferred Work

- **Code extraction is a consumer projection, not a second mailbox** — keyword-adjacent digit and mixed tokens will miss unusual senders; empty output points at `mail_list_recent` / `mail_read` so a regex miss is recoverable ([mail capability seam](../../../.agents/notes/implemented/architecture/2026-08-22-mail-capability-seam.md)).
- **The model-facing API is minimal by design** — `limit` is the only optional tool argument; scan/list caps and timeouts stay deployment config, matching the web tools' bound-vs-argument split.
- **No mail-specific permission policy** — the tools execute without requesting `ctx.approval`; a deployment that needs confirmation must add a `tools/pre-execute` policy.
