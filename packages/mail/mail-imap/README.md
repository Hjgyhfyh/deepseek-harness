# @deepseek-ai/dsh-mail-imap

English | [中文](README.zh.md)

The IMAP **Service Provider** for the mail capability seam (`ctx.mail`): a `MailListProvider` and `MailReadProvider` backed by one account on an IMAP server.

| Package | Role |
|---|---|
| `@deepseek-ai/dsh-mail` | Service Definition: `ctx.mail`, selection, vocabulary |
| `@deepseek-ai/dsh-mail-imap` (this) | Provider: IMAP `SELECT`/`UID FETCH` against the configured account |
| `@deepseek-ai/dsh-tool-mail` | Consumer: model-facing tools over `ctx.mail` |

## Design

- **One short-lived connection per operation.** Every `list()`/`read()` connects (implicit TLS by default), logs in through the credential seam, SELECTs the mailbox, runs one or two commands, and closes. No idle socket to babysit; an agent's occasional reads never hold server resources.
- **Credentials ride the seam.** Configuration carries `passwordEnv` — a credential reference resolved per connection via `ctx.credentials`. No secret ever lands in `cordis.yml`.
- **`BODY.PEEK[...]` only.** Fetches never set `\Seen`; reading mail through the harness leaves mailbox flags untouched.
- **Decoding is best-effort, never throwing.** RFC 2047 encoded words, quoted-printable/base64 bodies, and declared charsets decode with graceful fallbacks; unknown charsets degrade to UTF-8 rather than failing the read.
- **Bounded work.** `maxScan` bounds how deep a list reaches into the mailbox, `maxBodyChars` caps decoded text per read, and `timeoutMs` bounds each connect+command exchange.

## Config

| Field | Meaning | Default |
|---|---|---|
| `host` | IMAP server hostname | required |
| `port` | Server port | 993 (`secure`) / 143 |
| `secure` | Implicit TLS on connect | `true` |
| `user` | Login user (set the address explicitly) | falls back to `host` |
| `passwordEnv` | Credential reference carrying the password | required |
| `mailbox` | Mailbox to SELECT | `INBOX` |
| `maxScan` | Newest-message scan window per list | 50 |
| `maxBodyChars` | Per-read character cap on decoded text | 20000 |
| `timeoutMs` | Per-operation timeout | 30000 |
| `sinceHours` | List only messages newer than this many hours | newest unconditionally |

## Enabling a deployment mailbox

This tree's base bundle enables `mail-imap` against `telepasta.ru` / `catchall@telepasta.ru`. The password still resolves from `passwordEnv` (`MAIL_IMAP_PASSWORD`); it never enters YAML. Other deployments restate `host`, `user`, and `passwordEnv`.

```yaml
- id: mail-imap
  config:
    host: telepasta.ru
    user: catchall@telepasta.ru
    passwordEnv: MAIL_IMAP_PASSWORD
    sinceHours: 48
```

If Dovecot listens only on localhost, run the harness on that host or tunnel IMAP. `passwordEnv` names the credential to resolve at each connection (typically `MAIL_IMAP_PASSWORD` in the process environment or `.env`).

## Model Experience

Indirectly, through [`dsh-tool-mail`](../tool-mail/README.md), which retains bounded decoded list and read text or the structured `MailError` codes this provider surfaces while IMAP transport stays hidden.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

- Plaintext IMAP (`secure: false`) exists for loopback/private-VPS deployments; there is no STARTTLS upgrade path.
- One account per provider instance; multi-account deployments mount multiple plugin rows.
- No persistent UIDVALIDITY cache: UIDs are opaque per session, and the tool layer round-trips them within one conversation.
