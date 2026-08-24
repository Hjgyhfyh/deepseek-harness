# mail/ — 邮件能力系列

[English](README.md) | 中文

本系列提供与提供方无关的邮箱 list/read 操作，以及消费它们的面向模型工具。

| 包 | 角色 | ctx 键 |
|---|---|---|
| [`mail/`](mail/README.md) | 定义邮件提供方注册、选择和共享错误 | `ctx.mail` |
| [`mail-imap/`](mail-imap/README.md) | 通过 IMAP 提供 list 与 read | 注册到 `ctx.mail` |
| [`tool-mail/`](tool-mail/README.md) | 向模型暴露 `mail_codes`、`mail_list_recent` 和 `mail_read` | 注册到 `ctx.tools` |

[邮件能力决策](../../.agents/notes/implemented/architecture/2026-08-22-mail-capability-seam.md) 记录了 list 与 read 为何共享一个提供方选择服务，以及 `mail_codes` 为何是消费方投影而不是第二套邮箱。

子系统参考——list/read 请求与结果、可用性、`MailError` ——见 [docs/subsystems/mail.md](../../docs/subsystems/mail.md)。
