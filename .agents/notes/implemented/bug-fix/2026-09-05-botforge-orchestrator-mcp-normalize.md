# Agent Note: Orchestrator MCP rows go through normalizeMcp

Status: implemented

English | [中文](2026-09-05-botforge-orchestrator-mcp-normalize.zh.md)

## Problem

`applyOrchestrator` copied `section.mcp` as-is. A sparse stored row (name and command only) kept optional `args`/`env`/`headers` under `exactOptionalPropertyTypes`, so `orchestrator().mcp` was not a complete `BotForgeMcpServer[]`.

## Decision

`applyOrchestrator` maps `section.mcp` through `normalizeMcp`, the same helper workers already use. A missing `mcp` array becomes `[]`.

## Alternatives considered

**Spread each MCP row in `applyOrchestrator` only.** Rejected: `normalizeMcp` already owns the complete row.

**Leave sparse MCP on the orchestrator because extras.ts normalizes at spawn.** Rejected: `orchestrator()` and the prompt section read `live.orch.mcp` before spawn.

## Consequences

A stored `{ name, command }` orchestrator MCP row has empty `args`, `env`, `cwd`, `url`, and `headers`. Prompt listing and extras spawn see the same complete row.

## Testing

`packages/botforge/botforge/tests/index.spec.ts` pins a sparse orchestrator MCP commit to the full `normalizeMcp` row.

## Related

[BotForge worker normalize fills required strings](2026-09-05-botforge-normalize-worker-required-fields.md) owns the employee-side `normalizeMcp` call.
