# Agent Note: The chat flow surfaces a max-tokens turn end

Status: implemented

English | [中文](2026-08-12-max-tokens-turn-end-notice.zh.md)

## Problem

The agent loop records `max-tokens` as its own `turn/end` reason, but no user surface consumed it. In the Web chat flow only `reason.kind === 'error'` built a conversation node, and the unknown-surface fallback claims append-surface events only, so a turn the provider cut at its output cap ended with no visible sign: the truncated answer read as a normal completion, and the user had no way to tell why the run stopped (issue #1522).

## Decision

A `turn-max-tokens` conversation node Definition matches `turn/end` with `reason.kind === 'max-tokens'` and materializes a persistent chat row at the turn position: a warning StateDot, a localized title, guidance that the truncated output is preserved, and — while the agent is idle — the same Continue control the composer shows. Clicking Continue admits the Host-owned resume notice documented in [stream idle retry and idle Continue](2026-08-24-stream-idle-retry-and-continue.md). The node derives from the durable session event alone, so refresh, restore, and history replay rebuild it identically. It shows no token numbers: the event carries none, and the notice must not fabricate budget data the provider did not report.

The renderer registers under the keyed `conversation.chat.node` seat like every chat row, and the legacy chat-snapshot contribution includes the node. The fixture history gained a max-tokens sample turn (72; the image and todo turns shifted to 73 and 74), and an assembled keyless snapshot pins the dot state, title, and hint, so a regression that routes max-tokens through the error presentation or silences it again changes a golden.

## Alternatives considered

**Extending `turn-error` with a max-tokens arm** — rejected: the acceptance for issue #1522 requires that max-tokens not read as a provider error; a shared node kind couples the two presentations, and the two reasons carry different data (an error payload versus nothing).

**A turn-tail marker instead of a flow row** — rejected: the tail renders closing chrome for a finished turn and its actions collapse on later turns, while the truncation notice must stay at the turn that was cut and remain visible in history without interaction.

**A continue or retry action button on the notice** — Continue now ships as the Host-owned continuation notice; this note still owns only the `turn-max-tokens` row. Same-turn splice remains rejected: the loop has already closed the truncated turn.

## Consequences

Max-tokens turn ends are visible, localized, and distinct from both errors and normal completion across live streaming, reload, and replay. The fixture renumbering cost two comment updates in dependent snapshots, and anything pinning fixture turn numbers must count from the new layout. Surfaces other than the Web chat flow (ACP and SDK consumers) keep mapping the reason through their own presentations and are unchanged.
