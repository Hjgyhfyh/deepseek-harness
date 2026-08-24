# @deepseek-ai/dsh-mail-imap

[English](README.md) | 中文

mail 能力 seam（`ctx.mail`）的 IMAP **Service Provider**：由一个 IMAP 服务器上的单个账户支撑的 `MailListProvider` 与 `MailReadProvider`。

| 包 | 角色 |
|---|---|
| `@deepseek-ai/dsh-mail` | Service Definition：`ctx.mail`、选择、词汇 |
| `@deepseek-ai/dsh-mail-imap`（本包） | Provider：对配置账户执行 IMAP `SELECT`/`UID FETCH` |
| `@deepseek-ai/dsh-tool-mail` | Consumer：基于 `ctx.mail` 的模型侧工具 |

## 设计

- **每次操作一条短连接。** 每次 `list()`/`read()` 都建立连接（默认隐式 TLS）、通过凭据 seam 登录、SELECT 邮箱、执行一两条命令后关闭。没有需要照料的空闲套接字；agent 偶发的读取从不占用服务器资源。
- **凭据走 seam。** 配置只携带 `passwordEnv`——一个凭据引用，在每条连接上经 `ctx.credentials` 解析。任何密钥都不会落入 `cordis.yml`。
- **只用 `BODY.PEEK[...]`。** 抓取从不置位 `\Seen`；通过 harness 读邮件不会碰邮箱标记。
- **解码尽力而为，绝不抛出。** RFC 2047 encoded word、quoted-printable/base64 正文以及声明的字符集都以优雅回退解码；未知字符集退化为 UTF-8 而不是让读取失败。
- **有界工作。** `maxScan` 限制一次列表向邮箱深处探查的范围，`maxBodyChars` 限制单次读取的解码文本，`timeoutMs` 限制每次连接+命令交互。

## 配置

| 字段 | 含义 | 默认 |
|---|---|---|
| `host` | IMAP 服务器主机名 | 必填 |
| `port` | 服务器端口 | 993（`secure`）/ 143 |
| `secure` | 连接即 TLS | `true` |
| `user` | 登录用户（显式填地址） | 回退为 `host` |
| `passwordEnv` | 携带密码的凭据引用 | 必填 |
| `mailbox` | 操作前 SELECT 的邮箱 | `INBOX` |
| `maxScan` | 单次列表的最新邮件扫描窗口 | 50 |
| `maxBodyChars` | 单次读取的解码文本上限 | 20000 |
| `timeoutMs` | 单次操作超时 | 30000 |
| `sinceHours` | 只列出最近 N 小时的邮件 | 无条件取最新 |

## 启用部署邮箱

本仓库的 base bundle 已对 `mail.telepasta.ru` / `catchall@telepasta.ru` 启用 `mail-imap`。密码仍从 `passwordEnv`（`MAIL_IMAP_PASSWORD`）解析，不进入 YAML。其他部署重写 `host`、`user` 与 `passwordEnv`。

```yaml
- id: mail-imap
  config:
    host: mail.telepasta.ru
    user: catchall@telepasta.ru
    passwordEnv: MAIL_IMAP_PASSWORD
    sinceHours: 48
```

若 Dovecot 只监听 localhost，在该主机上运行 harness 或隧道转发 IMAP。`passwordEnv` 是每次连接时解析的凭据名（通常是进程环境或 `.env` 中的 `MAIL_IMAP_PASSWORD`）。

## 模型体验

间接地通过 [`dsh-tool-mail`](../tool-mail/README.md)：它保留有界的解码列表与正文，或本 provider 抛出的结构化 `MailError` code，而 IMAP 传输细节保持隐藏。

#### KV Cache 影响

无直接失效；由具名的 consumer 负责其请求前缀变化。

## 已知限制与延期工作

- 明文 IMAP（`secure: false`）面向环回/私有 VPS 部署；没有 STARTTLS 升级路径。
- 每个 provider 实例一个账户；多账户部署挂载多条插件行。
- 不持久化 UIDVALIDITY 缓存：UID 在会话内不透明，工具层只在同一段对话内回传它们。
