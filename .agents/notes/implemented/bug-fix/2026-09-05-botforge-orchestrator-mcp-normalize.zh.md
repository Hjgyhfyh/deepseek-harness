# Agent Note: 编排器 MCP 行走 normalizeMcp

Status: implemented

[English](2026-09-05-botforge-orchestrator-mcp-normalize.md) | 中文

## Problem

`applyOrchestrator` 原样复制 `section.mcp`。稀疏的存储行（只有 name 和 command）在 `exactOptionalPropertyTypes` 下仍让 `args`/`env`/`headers` 可选，因此 `orchestrator().mcp` 不是完整的 `BotForgeMcpServer[]`。

## Decision

`applyOrchestrator` 把 `section.mcp` 经 `normalizeMcp` 映射，与员工行相同。缺失的 `mcp` 数组变成 `[]`。

## Alternatives considered

**只在 `applyOrchestrator` 里展开每一行 MCP。** 否决：完整行已经由 `normalizeMcp` 拥有。

**编排器保留稀疏 MCP，因为 extras.ts 在 spawn 时规范化。** 否决：`orchestrator()` 与 prompt 段在 spawn 之前读取 `live.orch.mcp`。

## Consequences

存储的 `{ name, command }` 编排器 MCP 行带有空的 `args`、`env`、`cwd`、`url`、`headers`。Prompt 列表与 extras spawn 看到同一份完整行。

## Testing

`packages/botforge/botforge/tests/index.spec.ts` 把稀疏的编排器 MCP 提交钉成完整的 `normalizeMcp` 行。

## Related

[BotForge 员工规范化补齐必填字符串](2026-09-05-botforge-normalize-worker-required-fields.md) 拥有员工侧的 `normalizeMcp` 调用。
