# Agent Note: 邮箱访问是带 list 与 read 工具的能力 seam

Status: implemented

[English](2026-08-22-mail-capability-seam.md) | 中文

## 问题

agent 运营的账号通过发送到 VPS 私有域名邮箱（此处为 `@telepasta.ru`）的一次性验证码进行确认。外部通道已经存在——一个解析验证码并推送的 Telegram bot——但 harness agent 本身没有邮件访问能力。当外部解析器漏掉一个验证码、弄错它，或 agent 需要解析器丢弃的上下文时，agent 就卡住了：它看不到实际收到了什么。

两种读取需求不同，形状也不同。扫描最近收到的是元数据问题——发件人、主题、日期，廉价且可重复。找回预览中没有显示的验证码是正文问题——一封邮件，完整解码文本。把模型契约绑定到一台邮件服务器的 wire protocol，或一个解析器的输出，会重复 [web seam](2026-06-24-web-capability-seam.md) 已经在搜索和 fetch 上避免的错误。

## 决策

邮箱访问是遵循[能力 seam Agent Note](2026-06-13-capability-seams.md) 的一等能力 seam，与 web 相同的三种角色：

1. `@deepseek-ai/dsh-mail`（`packages/mail/mail`）拥有 `ctx.mail`、list 与 read 提供方注册表、执行期提供方选择、共享请求/结果词汇和 `MailError`。
2. `@deepseek-ai/dsh-mail-imap`（`packages/mail/mail-imap`）用一个提供方注册两个能力。每次操作开一条短生命周期 IMAP 连接：SELECT 配置的邮箱，运行一次 `BODY.PEEK` 抓取，关闭。抓取的 `BODY[TEXT]` 按其 MIME 结构解码：multipart 正文按声明的 boundary 拆分，最优文本叶子胜出（`text/plain` 优先于 `text/html`），传输编码与字符集逐部分解码。登录在每次操作中经凭据 seam 解析 `passwordEnv`——配置只携带引用，绝不含值。读取从不翻转 `\Seen`。
3. `@deepseek-ai/dsh-tool-mail`（`packages/mail/tool-mail`）拥有面向模型的 `mail_codes`、`mail_list_recent` 和 `mail_read` 工具 schema、提示词引导、上限和展示。

提供方注册能力；消费方拥有面向模型的名称与 schema。无论提供方状态如何，工具保持注册——已启用但提供方未配置的工具在执行期以结构化 `MailError` 失败（`MAIL_PROVIDER_UNAVAILABLE`、`MAIL_CREDENTIAL_MISSING` 等），因此配置错误表现为可路由的错误，而不是缺失的 schema。

两步流程是有意为之。`mail_list_recent` 只抓取头部，返回发件人、主题、日期和不透明 id；`mail_read` 按需传输一个解码正文，由字符上限约束。seam 在返回时强制执行列表上限，如同 `ctx.web` 强制执行 `maxResults`。

`mail_codes` 是同一条 list+read 路径上的消费方投影：打开最新邮件、提取可能的验证码、返回紧凑行。未找到码是成功的空结果，并告诉模型使用 `mail_list_recent` 和 `mail_read` —— 提取器不是第二套邮箱，不得把恢复路径藏起来。外部 Telegram bot 解析器作为推送通道仍然有用。

本仓库的 base bundle 对 `mail.telepasta.ru` / `catchall@telepasta.ru` 启用 `mail-imap`，并设置 `tool-mail.mailboxHint`。密码仍从 `passwordEnv`（`MAIL_IMAP_PASSWORD`）解析，绝不进入 YAML。`mail_codes`、`mail_list_recent` 和 `mail_read` 在父 agent 与每个进程内子 agent 上保持注册（BotForge 雇员继承它们；拒绝列表只有委派工具）。常驻提示词要求模型直接调用这些工具，而不是 grep 工作区或再拉起 Telegram 去读信。

```text
@deepseek-ai/dsh-tool-mail  --depends on-->  @deepseek-ai/dsh-mail  <--depends on--  @deepseek-ai/dsh-mail-imap
        consumer                                 interface                       implementation
```

## 曾考虑的替代方案

### 让 IMAP 提供方注册自己的工具

因 web seam 否决提供方自有工具的同样原因否决：工具名称、描述和 schema 将取决于加载了哪些提供方包，更换后端（IMAP 到某邮件服务商 API）会改变模型契约。`dsh-tool-mail` 是面向模型文本的唯一所有者。

### 把验证码提取解析器做成第二套邮箱后端

否决：第二套 IMAP/Telegram 解析器会把失手藏起来（「未找到验证码」），并把模型契约绑到一个解析器的输出。实际交付的是解码后 list+read 文本上的消费方投影。空输出必须指向 `mail_list_recent` / `mail_read`，这样正则失手仍可恢复。关键词邻近的数字与混合 token 仍会漏掉少见发件人；可以接受，因为恢复仍在同一条 seam 上。

### 一个返回最新若干封完整正文的工具

否决：正文才是昂贵的部分。一次传输 N 个完整正文的列表会把签名、免责声明和 HTML 样板灌进上下文，只为回答一个元数据问题。双工具拆分让扫描保持廉价，并让正文成本成为明确的逐封决策。

### POP3

否决：POP3 没有可与 IMAP UID 类比的服务端 UID 稳定抓取模型，没有邮箱选择，部分抓取语义更弱；让两步流程廉价的 header-only 列表依赖 `BODY.PEEK[HEADER.FIELDS …]`。IMAP 也是自托管邮件服务器（Dovecot 等）默认暴露的协议。

## 结果

- 邮件词汇是提供方无关的：未来后端（某邮件服务商 API、本地 Maildir）向 `ctx.mail` 注册即可，不必触碰工具 schema，镜像 web seam 的提供方替换。
- 读邮件从不标记已读，agent 和人类邮件客户端可以共享同一邮箱而不会互相藏信。
- 凭据按操作解析，轮换邮箱密码在下一次调用即生效，无需重启。
- 缺少 IMAP 密码时每次调用以 `MAIL_CREDENTIAL_MISSING` 失败；工具仍留在 schema 中，模型能看见它们。进程内子 agent 继承同一套工具。
- IMAP 客户端是最小的专用实现（tag 命令、literal、FETCH section）——不是完整的 RFC 3501 客户端。SELECT/LOGIN/FETCH/LOGOUT 语义之外的命令、STARTTLS 和 IDLE 不在范围内；seam 的需求由 list、read 和 codes 工具界定。
