# @deepseek-ai/dsh-mail

[English](README.md) | 中文

**`MailRuntime`**（`ctx.mail`）定义 harness 拥有的邮箱访问能力——列出最近邮件、完整读取一封——通过多个 provider 实现，而不把模型契约绑定到某一个后端的协议上。

本包拥有 mail 能力的 Service Definition 角色。与 web 一样，它在同一条 seam 上承载两个操作（list 与 read），每个操作都可有多个 provider：

| 包 | 角色 |
|---|---|
| `@deepseek-ai/dsh-mail`（本包） | Service Definition：服务、provider 注册表、选择策略、请求/结果词汇、`MailError` 分类 |
| `@deepseek-ai/dsh-mail-imap` | Provider：对配置账户执行 IMAP `LIST`/`FETCH` |
| `@deepseek-ai/dsh-tool-mail` | Consumer：基于 `ctx.mail` 的模型侧 `mail_codes` / `mail_list_recent` / `mail_read` 工具 schema |

list 和 read 不共享请求 schema，也不共享业务逻辑，但刻意共用一条 seam：`ctx.mail` 是单一的邮箱访问中间层，只有一个 provider 选择策略属主、一套中止/错误词汇、一个面向产品的“harness 如何访问邮箱”配置面。`List`/`Read` 方法对刻意保持平行。

## 服务 API（`ctx.mail`）

| 成员 | 语义 |
|---|---|
| `registerListProvider(provider)` / `registerReadProvider(provider)` | 注册后端。同一能力内 id 重复时抛出 `MailError` `MAIL_DUPLICATE_PROVIDER`。返回 disposer，随调用 fiber 释放。 |
| `list(request, signal?)` | 解析 list provider 并执行一次列表。在结果上强制 `request.limit`（保留最新 `limit` 封，置位 `truncated`）。无法运行时抛出 `MailError`。 |
| `read(request, signal?)` | 解析 read provider 并读取一封邮件。无法安全获取或表示邮件、以及没有邮件携带所请 id 时抛出 `MailError`。 |

Provider 注册的是**能力**，不是工具。模型侧的名称、描述、提示指引、JSON schema 与呈现只归 `dsh-tool-mail` 所有。

## 选择

选择从不依赖注册、配置或 HMR 顺序。能力可以显式指定 provider id（配置 `listProvider`/`readProvider`，或等价地注入同一字段的环境变量 `$DSH_MAIL_LIST_PROVIDER`/`$DSH_MAIL_READ_PROVIDER`），或在没有 id 时恰好存在唯一可用 provider 时自动选中。`list()`/`read()` 在执行期解析 provider：

| 情形 | 执行 |
|---|---|
| 配置的 id 已注册且 `available()` | 运行该 provider |
| 配置的 id 未注册 | `MAIL_PROVIDER_CONFIGURED_MISSING` |
| 配置的 id 已注册但不可用 | `MAIL_PROVIDER_CONFIGURED_UNAVAILABLE` |
| 无 id，恰好一个已注册可用 provider | 运行它 |
| 无 id，没有可用 provider | `MAIL_PROVIDER_UNAVAILABLE` |
| 无 id，多个可用 provider | `MAIL_PROVIDER_AMBIGUOUS` |

失败分支抛出 `MailError`，其结构化 code（加上消息细节——缺失的 id、歧义的候选集）供直接调用方路由。provider 自身的 `available()` 是廉价的本地检查（凭据存在、配置可解析），它参与执行期选择但**绝不发起网络调用**；`dsh-tool-mail` 从不调用它——工具通过 `ctx.mail.list()`/`read()` 执行并按抛出的 code 路由，因此 provider 选择只有一个属主。

## 词汇

`MailListRequest`（`limit`）→ `MailListResult`（`messages[]`、`truncated`）；每条 `MailMessageSummary` 携带不透明 `uid`、`from`、`subject` 和可选 ISO-8601 `date`。`MailReadRequest`（`uid`）→ `MailReadResult`（`uid`、`subject`、`from`、解码后的 `text`、`truncated`）；取消是传给 `list()`/`read()` 的直接可选 `AbortSignal` 参数。read 结果的 `truncated` 报告 provider 对正文的字符上限，而非 list 上限。完整契约与 `MailError` code 分类见 `src/types.ts`。

## 模型体验

间接地通过 `dsh-tool-mail`：它保留有界的规范化 provider 数据，或在失败时精确保留 configured-provider、unavailable-provider、no-provider、multiple-provider、unknown-id 与 `Error: <message>` 各类失败，而本注册表自身不贡献任何 prompt 或 schema。

#### KV Cache 影响

无直接失效；由具名的 consumer 负责其请求前缀变化。

## 已知限制与延期工作

- **无观测面**——没有 provider 变更事件，也没有能力状态查询；可用性只能通过执行 `list()`/`read()` 并路由抛出的 `MailError` code 观察，与 web seam 移除观测面的决定一致。
- **无文件夹/邮箱选择**——provider 只服务其配置的账户；在第二个 consumer 出现之前，按请求切换文件夹被延期。
- **无发送/搜索能力**——这条 seam 是只读的；发信将是独立操作，自带滥用风险。
