# Agent Note: BotForge worker normalize fills required strings

Status: implemented

English | [中文](2026-09-05-botforge-normalize-worker-required-fields.zh.md)

## Problem

`normalizeWorker` spreads a sparse `raw` row into `BotForgeWorkerConfig`. Under `exactOptionalPropertyTypes`, omitted `name` (and the other required strings) stay optional, so the function's return is not a complete employee.

## Decision

`normalizeWorker` assigns every required field and does not spread `raw`. Omitted `name`, `role`, `roleDescription`, `hint`, `systemPrompt`, and `avatar` become `''`. `skills` and `triggers` copy from the source or `[]`. `mcp` maps through `normalizeMcp`. `enabled` is true unless the source is exactly `false`. `avatarSeed` falls back to `id`.

## Alternatives considered

**Keep the spread and default only `name`.** Rejected: the other required strings have the same hole under `exactOptionalPropertyTypes`.

**Make those fields optional on `BotForgeWorkerConfig`.** Rejected: `delegate_employee` and the roster address employees by required identity fields.

## Consequences

A sparse `{ id }` row is a complete `BotForgeWorkerConfig`. Callers still must supply `id`. Host typecheck accepts the return.

## Testing

`packages/botforge/botforge/tests/config.spec.ts` pins `{ id: 'x' }` to the full defaulted row. `packages/botforge/botforge/tests/prompt.spec.ts` omits `origin` on a top-level header instead of passing `origin: undefined`.

## Related

[`dsh-botforge` config](../../../../packages/botforge/botforge/src/config.ts) owns the employee row type.
