# @deepseek-ai/dsh-tool-mail

[English](README.md) | 中文

mail 能力 seam 的 **Consumer** 角色：基于 `ctx.mail` 的模型侧 `mail_codes`、`mail_list_recent` 与 `mail_read` 工具。本包拥有 schema、校验、提示指引、限制与呈现——从不涉及具体 provider。

| 包 | 角色 |
|---|---|
| `@deepseek-ai/dsh-mail` | Service Definition：`ctx.mail`、选择、词汇 |
| `@deepseek-ai/dsh-mail-imap` | Provider：IMAP 后端 |
| `@deepseek-ai/dsh-tool-mail`（本包） | Consumer：基于 `ctx.mail` 的工具 schema |

## 工具

### `mail_codes`

扫描最新邮件并返回紧凑的验证码行（验证码、发件人、主题、id）。唯一可选参数：

- `limit`（整数）——打开最新多少封；受 `codesMaxResults`（默认 10）约束。

需要登录或确认码时先用这个工具。未找到码仍是成功的空结果，并提示模型回退到 `mail_list_recent` 和 `mail_read` —— 提取器是 Consumer 投影，不是第二套邮箱。

### `mail_list_recent`

列出部署邮箱中最新的邮件。唯一可选参数：

- `limit`（整数）——返回最新多少封；受部署的 `listMaxResults`（默认 10）约束。

每行返回发件人、主题、日期（如有）和不透明的邮件 id，并在超出上限仍有更多邮件时置位 `truncated`。id 是模型拿到的唯一句柄，原样回传给 `mail_read`。

### `mail_read`

按 id 完整读取一封邮件。唯一必填参数：

- `uid`（字符串）——与此前列表结果所给的完全一致的 id。

返回头部（`subject`、`from`）加解码后的正文文本，上限为 `readMaxOutputChars`（默认 40000）。两步流程是有意为之：列表保持廉价，正文只在需要时传输——模型先扫描预览，当预览未显示所需内容时再精确读取一封。

## 配置

| 字段 | 含义 | 默认 |
|---|---|---|
| `list` | 注册 `mail_list_recent` | `true` |
| `read` | 注册 `mail_read` | `true` |
| `codes` | 注册 `mail_codes` | `true` |
| `listMaxResults` | 列出邮件的上限 | 10 |
| `codesMaxResults` | `mail_codes` 打开邮件的上限 | 10 |
| `listTimeoutMs` | `mail_list_recent` 的协作预算 | 30000 |
| `readTimeoutMs` | `mail_read` 的协作预算 | 30000 |
| `codesTimeoutMs` | `mail_codes` 的协作预算 | 60000 |
| `readMaxOutputChars` | `mail_read` 完整输出上限 | 40000 |
| `mailboxHint` | 追加到常驻邮箱访问提示词的可选部署标识 | `''` |

启用开关只控制注册：没有可用 provider 时，已启用的工具仍然可见，并在执行期以结构化 `MAIL_*` 错误码失败。进程内子 agent（spawn、fork、BotForge 雇员）继承这些工具；常驻提示词要求直接调用它们，而不是 grep 工作区或再拉起 Telegram 去读信。

## 模型体验

### 系统提示词

#### 模型看到的内容

每个已启用工具贡献一段独立注册的提示词，外加一段常驻邮箱访问提示，列出已启用的工具名并要求模型直接调用（不要 grep，不要走 Telegram）。`mail_codes` 会根据同一组合是否也启用了 `mail_list_recent` 和 `mail_read` 选择恢复句。scope 工具限制不会移除这些区段。

##### 常驻邮箱访问指引（三个工具都启用）

```markdown
mail_codes, mail_list_recent, and mail_read are already registered tools on this agent and on every in-process child (including BotForge employees). Call them directly to read this process's mailbox. Do not grep or glob the workspace for those names. Do not spawn Telegram or another agent to read mail.
```

`mailboxHint` 在 trim 后非空时追加到该段。

##### 同时启用 list 与 read 时的验证码指引

```markdown
Use mail_codes first when you need a verification or login code from recent mail. It scans newest messages and returns compact code/from/subject rows. If it reports no codes, use mail_list_recent and mail_read to inspect the decoded body yourself.
```

##### 仅启用 list 时的验证码指引

```markdown
Use mail_codes first when you need a verification or login code from recent mail. It scans newest messages and returns compact code/from/subject rows. If it reports no codes, use mail_list_recent to inspect recent mail.
```

##### 仅启用 read 时的验证码指引

```markdown
Use mail_codes first when you need a verification or login code from recent mail. It scans newest messages and returns compact code/from/subject rows. If it reports no codes, use mail_read to inspect a message body.
```

##### 两个恢复工具都未启用时的验证码指引

```markdown
Use mail_codes first when you need a verification or login code from recent mail. It scans newest messages and returns compact code/from/subject rows.
```

##### 启用 read 时的列表指引

```markdown
Use mail_list_recent to see the newest messages in the connected mailbox. It returns senders, subjects, dates, and opaque message ids. Use mail_read with an id when you need the full body of one message.
```

##### 仅列表指引

```markdown
Use mail_list_recent to see the newest messages in the connected mailbox. It returns senders, subjects, dates, and opaque message ids.
```

##### 读取指引

```markdown
Use mail_read to fetch one mailbox message in full by the id mail_list_recent returned. It returns headers plus the decoded body text — use it when the list preview does not show the code or detail you need.
```

#### Token 影响

每个通过配置启用的工具，外加一段常驻邮箱访问提示，都会为每次请求增加固定的指引 token 开销，即使限制隐藏了 schema。切换 `list`、`read` 或 `codes` 会改写该常驻句，且对 `mail_codes` 还会改写恢复句。

#### KV Cache 影响

只要启用工具、scope 与指引文本不变，前缀就保持稳定。配置启用状态（包括因切换 list/read 而改写验证码指引）或插件生命周期可能使从第一个变化的提示词区段起的复用失效；scope schema 限制不会移除该区段。

### 工具 schema

#### 模型看到的内容

模型会看到生成的 [`mail_codes`、`mail_list_recent` 与 `mail_read` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-mail)。扫描/列表上限与超时预算属于部署设置，不是模型参数。

#### Token 影响

每次请求都会产生固定的 schema token 开销；通过配置禁用会同时移除 schema 与指引，scope 限制只移除 schema。

#### KV Cache 影响

只要定义与可见性不变，前缀就保持稳定。配置启用状态、插件生命周期或 scope 限制可能使从第一个变化的 schema token 起的复用失效。

### 验证码结果

#### 模型看到的内容

命中渲染为 `Verification codes:`，随后是形状为 `- <code> from <from> [id: <uid>]` 的行，并可添加后缀 ` — <subject> — <date>`，再跟随 `Use mail_read with one of the ids above if a code looks wrong or is missing.`。扫描 N 封仍为空时写 `No verification codes found in the newest <N> messages. Use mail_list_recent to see recent mail and mail_read to inspect a message's full text.`；扫描 0 封则去掉计数。邮箱被截断时添加 `(More messages exist beyond the <N> scanned.)`。

#### Token 影响

数据相关行会重复发送直到压缩（compaction），扫描窗口由 `codesMaxResults` 限制。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

### 列表结果

#### 模型看到的内容

非空列表是 `Recent messages:`，随后是形状为 `- <from> [id: <uid>]` 的行，并可添加后缀 ` — <subject> — <date>`，再跟随 `Use mail_read with one of the ids above to see its full text.`。空邮箱写 `No messages found.`。列表被截断时添加 `(More messages exist beyond the <N> shown.)`。

#### Token 影响

数据相关行会重复发送直到压缩，列表由 `listMaxResults` 限制。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

### 读取结果

#### 模型看到的内容

成功读取的精确形状是 `Message <uid> — <subject-or-(no subject)>`、一行 `From: <from>`、一个空行，以及解码后的正文。发生截断时会再添加一个空行和 `(Message truncated. Ask for a narrower excerpt or check the sender for the full text.)`；失败变为 `Error: <message>`。邮件 id 保留在调用历史中。

#### Token 影响

`readMaxOutputChars` 限制完整输出；保留的调用参数与结果会重复发送直到压缩，超时策略可以把迟到结果替换为简短错误。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

### 参数错误

#### 模型看到的内容

空白 `uid` 精确变为 `Error: uid must be a non-empty string`。非正 `limit` 精确变为 `Error: limit must be a positive integer`。

#### Token 影响

只有失败的这次调用会增加这些被保留的 token。

#### KV Cache 影响

仅追加；新可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

## 已知限制与延期工作

- **验证码提取是消费方投影，不是第二套邮箱** —— 关键词邻近的数字与混合 token 仍会漏掉少见发件人；空输出指向 `mail_list_recent` / `mail_read`，因此正则失手仍可恢复（[邮件能力 seam](../../../.agents/notes/implemented/architecture/2026-08-22-mail-capability-seam.md)）。
- **面向模型的 API 按设计保持最小** —— `limit` 是唯一可选工具参数；扫描/列表上限与超时留在部署配置中，与 web 工具的 bound-vs-argument 划分一致。
- **没有邮件专用许可策略** —— 这些工具执行时不请求 `ctx.approval`；需要确认的部署必须另加 `tools/pre-execute` 策略。
