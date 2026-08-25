# Agent Note: Stream idle retry and idle Continue

Status: implemented

[English](2026-08-24-stream-idle-retry-and-continue.md) | 中文

## Problem

一次进行中的轮次可能在没有自动恢复、也没有一键续跑的情况下停下。pi-ai SDK 会在大约 95 秒内没有非 ping 的 SSE 事件时失败，并把文案压成不含 `timeout` 词的 `Stream produced no non-ping SSE event within 95000ms`，于是 `classifyPiAiError` 记为 `PI_AI_ERROR`，`dsh-llm-retry` 不会重试。Harness 空闲 watchdog 默认五分钟，且只在 iterator `next()` 时重新布防；SSE ping 不会成为 `StreamChunk`，因此只发出 ping 的长思考也会落到 `pi-ai stream idle timeout after 300000ms`。写着 `Try again in 60 seconds` 的 429 没有 `providerRetryAfterMs`，默认 `maxDelayMs` 为 10 秒，系统会委托而不是等待。OpenRouter `404` `No active credentials for provider` 在凭据规则之前命中了 `invalid_request`，`Rate limit exceeded: free-models-per-day-stealth` 则命中 `RATE_LIMIT` 而不是配额耗尽。`max-tokens` 结束会让用户发送 `"continue"`，却没有 Continue 控件。Decepticon 的 `DECEPTICON_AUTH_PRIORITY` 回退不在本仓库。

## Decision

`classifyPiAiError` 在 `invalid_request` 之前把 `No active credentials for provider` 映射为 `MISSING_CREDENTIAL`，经 `isQuotaExceededError` 把 `free-models-per-day` 配额措辞映射为 `QUOTA`，把非 ping SSE 空闲和 `stream idle` 措辞映射为 `TIMEOUT`，并从 `Try again in 60 seconds` 这类压扁文本解析 `providerRetryAfterMs`。`Stream ended without finish_reason` 仍按 [pi-ai 传输截断分类](2026-07-22-pi-ai-transport-truncation-classification.md) 为 `TRANSPORT`。

两个远程适配器都将 `streamIdleTimeoutMs` 默认设为 15 分钟（`900000`）。pi-ai 在 profile 省略 `timeoutMs` 时把 SDK `timeoutMs` 设为同一间隔，并用 `onPayload` 脉冲空闲 watchdog，使 SSE ping 计为提供方活动。省略 retry 配置时 normal 策略为四次重试、120 秒延迟上限，从而遵守 60 秒的提供方延迟。

`session.prompt` 与 `subagent.prompt` 接受 `continuation: true`。Host 忽略客户端 `content`，并对插件来源通知（`plugin: agent-continue`，form 为 `notice`，摘要为 `Continue`）调用 `followup()`；面向模型的文本为 `Continue from where the previous reply stopped. Resume unfinished work; do not restart completed steps or repeat already delivered output.` Web 编辑器在所寻址 agent 于 active 或 engaging 会话空闲时显示 Continue；空闲的 turn-error 与 max-tokens 行提供同一控件。

## Alternatives considered

**把 `PI_AI_ERROR` 当作可重试。** 否决：该兜底仍包含永久失败。可恢复的空闲与截断措辞使用显式 code；见 [pi-ai 传输截断分类](2026-07-22-pi-ai-transport-truncation-classification.md) 中的同一备选。

**让用户把 `"continue"` 当作普通用户气泡输入。** 否决：续跑文本是 Host 拥有的模型可见输入，必须以插件通知写入会话日志，不得呈现为人类气泡，也不得接受调用方可控的客户端内容。

**把 max-tokens 输出拼回同一轮。** 否决：loop 已经关闭该轮。Continue 在保留的 transcript 上开启新的 follow-up 轮，这正是 max-tokens 提示已经描述的安全续跑。

**在本仓库实现 Decepticon `DECEPTICON_AUTH_PRIORITY` 回退。** 否决：本仓库没有 Decepticon 树。Harness 恢复只覆盖可重试 code、Retry-After、凭据与配额分类。

## Consequences

只发出 SSE ping 的长思考不再在 95 秒或五分钟处失败。60 秒的 `Retry-After` 会重试而不是放弃。缺失的 OpenRouter 凭据以 `MISSING_CREDENTIAL` 失败且不重试。每日 stealth 配额以 `QUOTA` 失败，而不是暂时性速率限制。只要 Web agent 无需新的用户气泡即可续跑，就会显示空闲 Continue。默认恢复可以等待更久、花费更多尝试（四次重试，延迟上限 120 秒）。

## Testing

`packages/llm/llm-pi-ai/tests/convert.spec.ts` 钉住 SSE 空闲、凭据、stealth 配额和 Retry-After 分类。`packages/llm/llm/tests/retry-policy.spec.ts` 与 `packages/llm/llm/tests/service.spec.ts` 钉住四次重试、120 秒上限、配额措辞和延迟解析。`packages/host/apiproxy/tests/api-proxy-continue.spec.ts` 与 `packages/host/apiproxy/tests/api-proxy-subagents.spec.ts` 钉住 Host 准入。客户端 Continue 钉在 `packages/client/runtime/tests/session.client.spec.ts`、`packages/client/ui-conversation/tests/input-bar.client.spec.tsx`、`packages/client/ui-conversation/tests/chat-view.client.spec.tsx` 和 `packages/client/ui-conversation/tests/apply-inject.client.spec.tsx`。`apps/web/tests/snapshots/` 下空闲 Web 编辑器与 turn-error 黄金文件钉住 Continue 控件；`apps/web/tests/snapshots/max-tokens-notice/history-turn.expected.txt` 钉住「点击继续」提示。

## Related

[LLM 暂时性请求失败的有界恢复](../architecture/2026-06-21-bounded-llm-request-recovery.md) 拥有结构化失败事实与重试执行。[聊天流展示 max-tokens 结束的轮次](2026-08-12-max-tokens-turn-end-notice.md) 拥有 `turn-max-tokens` 行。
