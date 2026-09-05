# Agent Note: Stream idle retry and idle Continue

Status: implemented

English | [中文](2026-08-24-stream-idle-retry-and-continue.zh.md)

## Problem

A live turn can stop with no automatic recovery and no one-click resume. pi-ai's SDK fails a stream that produces no non-ping SSE event within about 95 seconds, flattening the wording to `Stream produced no non-ping SSE event within 95000ms` with no `timeout` token, so `classifyPiAiError` stored `PI_AI_ERROR` and `dsh-llm-retry` did not retry. The harness idle watchdog defaulted to five minutes and rearms only on iterator `next()`; SSE pings never become `StreamChunk` values, so a long think that only emits pings also hit `pi-ai stream idle timeout after 300000ms`. A 429 that says `Try again in 60 seconds` carried no `providerRetryAfterMs`, and the default `maxDelayMs` of 10 seconds delegated instead of waiting. OpenRouter `404` `No active credentials for provider` matched `invalid_request` before the credential rule, and `Rate limit exceeded: free-models-per-day-stealth` matched `RATE_LIMIT` rather than exhausted quota. A `max-tokens` stop told the user to send `"continue"` with no Continue control. Decepticon `DECEPTICON_AUTH_PRIORITY` fallback is outside this repository.

## Decision

`classifyPiAiError` maps `No active credentials for provider` to `MISSING_CREDENTIAL` before `invalid_request`, maps `free-models-per-day` quota wording through `isQuotaExceededError` to `QUOTA`, maps non-ping SSE idle and `stream idle` wording to `TIMEOUT`, and attaches `providerRetryAfterMs` parsed from flattened text such as `Try again in 60 seconds`. `Stream ended without finish_reason` stays `TRANSPORT` per [pi-ai transport truncation classification](2026-07-22-pi-ai-transport-truncation-classification.md).

Both remote adapters default `streamIdleTimeoutMs` to 15 minutes (`900000`). pi-ai sets SDK `timeoutMs` to that interval when the profile omits `timeoutMs`, and `onPayload` pulses the idle watchdog so SSE pings count as provider activity. Normal retry omission uses four retries and a 120 second delay cap so a 60 second provider delay is honored.

`session.prompt` and `subagent.prompt` accept `continuation: true`. The Host ignores client `content` and `followup()`s a plugin-sourced notice (`plugin: agent-continue`, form `notice`, summary `Continue`) whose model-facing text is `Continue from where the previous reply stopped. Resume unfinished work; do not restart completed steps or repeat already delivered output.` The Web composer shows Continue while the addressed agent is idle on an active or engaging session, and idle turn-error and max-tokens rows offer the same control.

## Alternatives considered

**Treat `PI_AI_ERROR` as retryable.** Rejected: that catch-all still includes permanent failures. Recoverable idle and truncation wordings get explicit codes; see the same alternative in [pi-ai transport truncation classification](2026-07-22-pi-ai-transport-truncation-classification.md).

**Let the user type `"continue"` as an ordinary user bubble.** Rejected: the resume text is Host-owned model-visible input, must be reconstructable from the session log as a plugin notice, and must not appear as a human bubble or accept attacker-controlled client content.

**Splice max-tokens output into the same turn.** Rejected: the loop has already committed that step's `assistant/message`. Same-turn resume is `steer()` on `agent/turn-stopping`, documented in [max-tokens auto-continue](2026-08-25-max-tokens-auto-continue.md).

**Implement Decepticon `DECEPTICON_AUTH_PRIORITY` fallback here.** Rejected: this repository has no Decepticon tree. Harness recovery covers retryable codes, Retry-After, credentials, and quota classification only.

## Consequences

A long think that only emits SSE pings no longer fails at 95 seconds or five minutes. A 60 second `Retry-After` retries instead of giving up. Missing OpenRouter credentials fail as `MISSING_CREDENTIAL` and are not retried. Daily stealth quota fails as `QUOTA` rather than a transient rate limit. Idle Continue is visible wherever the Web agent can resume without a new user bubble. Default recovery can wait longer and spend more attempts (four retries, delays up to 120 seconds).

## Testing

`packages/llm/llm-pi-ai/tests/convert.spec.ts` pins SSE idle, credentials, stealth quota, and Retry-After classification. `packages/llm/llm/tests/retry-policy.spec.ts` and `packages/llm/llm/tests/service.spec.ts` pin four retries, 120 second cap, quota wording, and delay parsing. `packages/host/apiproxy/tests/api-proxy-continue.spec.ts` and `packages/host/apiproxy/tests/api-proxy-subagents.spec.ts` pin Host admission. Client Continue is pinned in `packages/client/runtime/tests/session.client.spec.ts`, `packages/client/ui-conversation/tests/input-bar.client.spec.tsx`, `packages/client/ui-conversation/tests/chat-view.client.spec.tsx`, and `packages/client/ui-conversation/tests/apply-inject.client.spec.tsx`. Idle Web composer and turn-error goldens under `apps/web/tests/snapshots/` pin the Continue control; `apps/web/tests/snapshots/max-tokens-notice/history-turn.expected.txt` pins the Click Continue hint.

## Related

[Bounded LLM request recovery](../architecture/2026-06-21-bounded-llm-request-recovery.md) owns structured failure facts and retry execution. [The chat flow surfaces a max-tokens turn end](2026-08-12-max-tokens-turn-end-notice.md) owns the `turn-max-tokens` row. [Max-tokens auto-continue](2026-08-25-max-tokens-auto-continue.md) steers the same notice before a truncated live turn closes.
