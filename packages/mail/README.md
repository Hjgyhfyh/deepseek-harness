# mail/ — mail capability family

English | [中文](README.zh.md)

This family provides provider-neutral mailbox list and read operations plus the model-facing tools that consume them.

| Package | Role | ctx key |
|---|---|---|
| [`mail/`](mail/README.md) | Defines mail provider registration, selection, and shared errors | `ctx.mail` |
| [`mail-imap/`](mail-imap/README.md) | Provides list and read through IMAP | registers on `ctx.mail` |
| [`tool-mail/`](tool-mail/README.md) | Exposes `mail_codes`, `mail_list_recent`, and `mail_read` to the model | registers on `ctx.tools` |

The [mail capability decision](../../.agents/notes/implemented/architecture/2026-08-22-mail-capability-seam.md) records why list and read share one provider-selection service, and why `mail_codes` is a consumer projection rather than a second mailbox.

The subsystem reference — list/read requests and results, availability, `MailError` — is [docs/subsystems/mail.md](../../docs/subsystems/mail.md).
