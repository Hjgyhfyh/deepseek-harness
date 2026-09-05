# Agent Note: Max-tokens auto-continue

Status: implemented

English | [中文](2026-08-25-max-tokens-auto-continue.zh.md)

## Problem

A live step that finishes `max-tokens` closes the turn. The user must click Continue after every truncated reply. A reasoning model with a small configured `maxTokens` hits that ceiling on every tool round, so a long unattended task cannot run.

## Decision

`ApiProxyService` installs an `agent/turn-stopping` listener when `autoContinueOnMaxTokens` is true (the default). If the open turn's latest `assistant/chunk` finish is `max-tokens`, `inbox.nextStep` is empty, and the turn signal is not aborted, the listener `steer()`s the Host continue notice owned by [stream idle retry and idle Continue](2026-08-24-stream-idle-retry-and-continue.md). The loop then runs another step in the same turn. A later completed step records `turn/end` `completed`; only a last step that remains `max-tokens` records `max-tokens`. Compositions that do not mount this gateway do not auto-continue.

## Alternatives considered

**Raise or omit the per-request `maxTokens` only.** Rejected as the sole fix: a reasoning model can still hit a provider or remaining-credit ceiling mid-reply. Omitting a configured cap is a deployment choice; auto-continue is the harness recovery.

**Splice truncated tokens into the same assistant message.** Rejected: the loop has already committed that step's `assistant/message`. `steer()` at `agent/turn-stopping` is the documented `/loop` extension, not a splice.

**Retry `max-tokens` inside agent-loop.** Rejected: new behavior belongs on documented extension points. The loop only changed turn-end assignment so a later completed step is not recorded as `max-tokens`.

**Cap auto-continues per turn.** Rejected: user Stop and provider quota bound a long run. A numeric cap would be a hardcoded tunable unless it were Config; unbounded continuation is the product behavior.

## Consequences

A truncated Web step no longer idles the agent. The `turn-max-tokens` row appears only when the last step is still truncated (auto-continue off, or a composition without this gateway). Each auto-continue is one additional user-role notice and consumes tokens. An unbounded truncated loop runs until Stop, error, or quota.

## Testing

`packages/host/apiproxy/tests/api-proxy-continue.spec.ts` pins the finish detector and the turn-stopping steer. `packages/host/apiproxy/tests/session-export.spec.ts` pins the Config default. `packages/core/agent-loop/tests/loop.spec.ts` pins last-step `completed` after a steered max-tokens step, and last-step `max-tokens` when no continuation runs.

## Related

[Stream idle retry and idle Continue](2026-08-24-stream-idle-retry-and-continue.md) owns the notice text and idle Continue RPC. [The chat flow surfaces a max-tokens turn end](2026-08-12-max-tokens-turn-end-notice.md) owns the `turn-max-tokens` row.
