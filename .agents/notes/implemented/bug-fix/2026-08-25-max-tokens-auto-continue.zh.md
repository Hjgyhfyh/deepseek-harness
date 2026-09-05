# Agent Note: Max-tokens auto-continue

Status: implemented

[English](2026-08-25-max-tokens-auto-continue.md) | 中文

## Problem

以 `max-tokens` 结束的实时步骤会关闭轮次。用户必须在每次截断后点击 Continue。配置了较小 `maxTokens` 的推理模型会在每一轮工具调用上撞到该上限，因此长时间无人值守的任务无法跑下去。

## Decision

`autoContinueOnMaxTokens` 为 true（默认）时，`ApiProxyService` 安装 `agent/turn-stopping` 监听器。若开放轮次最新的 `assistant/chunk` finish 是 `max-tokens`、`inbox.nextStep` 为空、且轮次信号未被 abort，监听器会对 [流空闲重试与空闲 Continue](2026-08-24-stream-idle-retry-and-continue.md) 所拥有的 Host 续跑通知调用 `steer()`。loop 随后在同一轮次再跑一步。之后若有一步正常完成，则 `turn/end` 记录 `completed`；只有最后一步仍是 `max-tokens` 时才记录 `max-tokens`。未挂载本网关的组合不会自动续跑。

## Alternatives considered

**只提高或省略单次请求的 `maxTokens`。** 否决为唯一修复：推理模型仍可能在回复中途撞上提供方或剩余额度上限。省略已配置上限是部署选择；自动续跑才是 harness 恢复。

**把截断 token 拼进同一条 assistant 消息。** 否决：loop 已经提交该步的 `assistant/message`。在 `agent/turn-stopping` 上 `steer()` 是已文档化的 `/loop` 扩展，不是拼接。

**在 agent-loop 内部重试 `max-tokens`。** 否决：新行为应落在已文档化的扩展点上。loop 只改了轮次结束赋值，使之后完成的步骤不再被记为 `max-tokens`。

**限制每轮自动续跑次数。** 否决：用户 Stop 与提供方配额约束长时间运行。数字上限若不做成 Config 就是硬编码可调参数；无界续跑才是产品行为。

## Consequences

被截断的 Web 步骤不再让 agent 空闲。`turn-max-tokens` 行只在最后一步仍被截断时出现（关闭自动续跑，或组合未挂载本网关）。每次自动续跑都是一条额外的 user-role 通知，并消耗 token。无界的截断循环会一直跑到 Stop、错误或配额。

## Testing

`packages/host/apiproxy/tests/api-proxy-continue.spec.ts` 钉住 finish 判定与 turn-stopping steer。`packages/host/apiproxy/tests/session-export.spec.ts` 钉住 Config 默认值。`packages/core/agent-loop/tests/loop.spec.ts` 钉住 steer 后最后一步为 `completed`，以及无续跑时最后一步为 `max-tokens`。

## Related

[流空闲重试与空闲 Continue](2026-08-24-stream-idle-retry-and-continue.md) 拥有通知文本与空闲 Continue RPC。[聊天流展示 max-tokens 结束的轮次](2026-08-12-max-tokens-turn-end-notice.md) 拥有 `turn-max-tokens` 行。
