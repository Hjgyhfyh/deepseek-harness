# 邮箱访问

[English](mail.md) | 中文

邮箱访问 seam 是一个[能力 seam](../../.agents/notes/implemented/architecture/2026-08-22-mail-capability-seam.md)，在同一个 `ctx.mail` 服务上横跨**两项操作**（list 与 read），并拆分到多个包：Service Definition（[dsh-mail](../../packages/mail/mail)，`ctx.mail` + 提供方注册表）、Service Provider（[dsh-mail-imap](../../packages/mail/mail-imap)）与 Consumer（[dsh-tool-mail](../../packages/mail/tool-mail)，即 `mail_codes` / `mail_list_recent` / `mail_read` 工具 schema）。Mail 是**一项可选能力**，不属于 agent loop 主干，因此其词汇定义在此而非 [core.md](core.md) 中。更换提供方不会改变模型请求最近邮件、单封完整内容或紧凑验证码扫描的方式。`mail_codes` 是 list+read 上的消费方投影：未找到码是指向 `mail_list_recent` 与 `mail_read` 的空成功结果，而不是第二套邮箱后端。

源码：[`packages/mail/mail/src/types.ts`](../../packages/mail/mail/src/types.ts)

## 为什么一项能力包含两项操作

列表与读取既不共享请求 schema，也不共享业务逻辑，但它们被有意设计为同一个 `ctx.mail` 中间层：一个提供方选择策略的所有者、一套中止与错误词汇，以及一个面向产品的「harness 如何访问邮箱」配置界面。代价是服务上平行的 `list`／`read` 方法对；这种并行是有意为之，而不是遗漏了可抽取的共性。提供方注册的是**能力**（`MailListProvider` 或 `MailReadProvider`），而非工具；面向模型的名称、schema、提示词引导与展示全部集中在唯一的消费方 `dsh-tool-mail` 中。

## 列表请求与结果

面向模型的工具参数至多是一个 `limit`；结果数上限归消费方所有（`dsh-tool-mail` 的 `listMaxResults` 配置，默认 `10`）并在返回时强制执行——如果提供方返回超量，seam 保留最新的 `limit` 封邮件并置位 `truncated`。

```ts type-equiv
/**
 * What one list-capable backend is asked to return. The request carries no
 * folder: a provider serves its configured mailbox (the deployment's account).
 */
interface MailListRequest {
  /** Upper bound on returned messages; the newest `limit` win. */
  readonly limit: number
}
```

```ts type-equiv
/**
 * One listed message: enough metadata to pick a message to read without any
 * body transfer. `uid` is opaque to consumers — round-trip it into
 * {@link MailReadRequest.uid}; only the issuing provider interprets it.
 */
interface MailMessageSummary {
  /** Opaque provider message id, stable within one provider instance. */
  readonly uid: string
  /** `From` header value as received (usually `"Name" <addr>`). */
  readonly from: string
  /** Subject as received; an absent header reads as the empty string. */
  readonly subject: string
  /** Message date as an ISO-8601 UTC string, or omitted when undated. */
  readonly date?: string
}
```

## 读取请求与结果

```ts type-equiv
/** What one read-capable backend is asked to retrieve. */
interface MailReadRequest {
  /** The opaque id exactly as a prior list result supplied it. */
  readonly uid: string
}
```

读取从不翻转邮箱标记：提供方以 `BODY.PEEK` 语义抓取，agent 读邮件不会碰 `\Seen`。

MIME 解码归提供方所有。`multipart/*` 主体按声明的 boundary 拆分，每个顶层部分解析为头部加负载；最优文本部分胜出（`text/plain` 优先于 `text/html`），传输编码与字符集逐部分解码。嵌套的 multipart 作为一个不透明部分浮出，其原始文本是兜底，因此未识别的结构退化为可读文本而非空结果。单部分主体没有部分头部：其内容类型与传输编码挂在消息级头部上。纯 HTML 主体会剥离为可读文本。

```ts type-equiv
/**
 * Normalized read outcome. `text` is the decoded body text of the first
 * non-empty text part (`text/plain` preferred over `text/html`), already
 * bounded by the provider's character cap. A successful read of an empty body
 * is a result with empty `text`, not an error.
 */
interface MailReadResult {
  readonly uid: string
  readonly subject: string
  readonly from: string
  /** Decoded body text; empty when the message carries none. */
  readonly text: string
  /** True when the provider cut the decoded text at its character cap. */
  readonly truncated: boolean
}
```

## 提供方可用性

提供方的 `available(): boolean` 是廉价的本地检查（凭据引用可解析、配置可读），**绝不发起网络调用**。它是执行期选择的输入，不是健康检查系统：`list()`/`read()` 读取它来挑一个可用提供方，选择失败会以调用方可路由的结构化 `MailError` 浮出——其 code 与消息携带可分支的细节（缺失的 id 或歧义的候选集）。

选择从不依赖注册、配置或 HMR 顺序：能力可以显式指定提供方 id（配置 `listProvider`/`readProvider`，或等价注入同一字段的环境变量），或在没有 id 时恰好存在唯一可用提供方时自动选中；无 id 且多个可用是 `MAIL_PROVIDER_AMBIGUOUS`，不是先到先得。

## 错误

`MailError extends HarnessError`（[core.md](core.md) 错误分类），带开放的 `code: string`（与其他 seam 的错误一样——`LlmError`、`WebError`），不是封闭联合：提供方可以在不改 `dsh-mail` 的前提下抛出自己的 code，消费方必须容忍未知 code。code 按属主划分。seam 中立码由共享的 `MailRuntime` 契约抛出：`MAIL_PROVIDER_UNAVAILABLE`、`MAIL_PROVIDER_CONFIGURED_MISSING`、`MAIL_PROVIDER_CONFIGURED_UNAVAILABLE`、`MAIL_PROVIDER_AMBIGUOUS`、`MAIL_DUPLICATE_PROVIDER`（注册期编程错误，对应 `LlmRuntime` 的 `DUPLICATE_ADAPTER`）、`MAIL_ABORTED`、`MAIL_UNKNOWN_MESSAGE`、`MAIL_CREDENTIAL_MISSING`，以及 `MAIL_PROVIDER_ERROR`（提供方自身失败经 seam 浮出的兜底码，包括网络/传输失败——DNS、连接拒绝、TLS）。

## 凭据

配置永不携带密码：`dsh-mail-imap` 接受 `passwordEnv`——一个凭据引用，在每条连接上经凭据 seam（`ctx.credentials`）解析。凭据缺失让每次操作以 `MAIL_CREDENTIAL_MISSING` 失败，而不是静默降级。

## 服务

`MailRuntime` 注册 list 与 read 提供方，以 `MAIL_DUPLICATE_PROVIDER` 拒绝重复 id，并在执行期以结构化选择错误解析提供方。IMAP 后端每次操作开一条短连接，经凭据 seam 登录，SELECT 配置的邮箱，只执行 `BODY.PEEK` 抓取。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->
<!-- END GENERATED cordis-surface -->
