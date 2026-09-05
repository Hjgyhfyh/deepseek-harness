# Agent Note: BotForge 员工规范化补齐必填字符串

Status: implemented

[English](2026-09-05-botforge-normalize-worker-required-fields.md) | 中文

## Problem

`normalizeWorker` 把稀疏的 `raw` 行展开进 `BotForgeWorkerConfig`。在 `exactOptionalPropertyTypes` 下，省略的 `name`（以及其他必填字符串）仍是可选的，函数返回值因此不是完整员工。

## Decision

`normalizeWorker` 为每个必填字段赋值，不展开 `raw`。省略的 `name` 回退到 `id`（与客户端花名册辅助函数相同）。省略的 `role`、`roleDescription`、`hint`、`systemPrompt`、`avatar` 变成 `''`。`skills` 与 `triggers` 从源复制或为 `[]`。`mcp` 经 `normalizeMcp` 映射。`enabled` 在源不是恰好 `false` 时为 true。`avatarSeed` 回退到 `id`。

## Alternatives considered

**保留展开，只给 `name` 默认值。** 否决：其余必填字符串在 `exactOptionalPropertyTypes` 下有同样的空洞。

**把这些字段在 `BotForgeWorkerConfig` 上改成可选。** 否决：`delegate_employee` 与花名册按必填身份字段寻址员工。

## Consequences

稀疏的 `{ id }` 行是完整的 `BotForgeWorkerConfig`。调用方仍必须提供 `id`。Host 类型检查接受该返回值。

## Testing

`packages/botforge/botforge/tests/config.spec.ts` 把 `{ id: 'x' }` 钉成完整默认行（`name` 等于 `id`）。`packages/botforge/botforge/tests/prompt.spec.ts` 在顶层 header 上省略 `origin`，而不是传入 `origin: undefined`。`packages/client/ui-workflow-run/tests/workflow-run.client.spec.tsx` 同样从远程行去掉 `origin`。

## Related

[`dsh-botforge` 配置](../../../../packages/botforge/botforge/src/config.ts) 拥有员工行类型。
