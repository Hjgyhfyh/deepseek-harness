# Agent Note: Omit undefined continueAgent on chat nodes

Status: implemented

English | [中文](2026-09-05-chat-continue-agent-omit.zh.md)

## Problem

`ChatNodeOwnerProps.continueAgent` is optional (`?: () => void`). `ChatNodeSeat` copied the prop onto the owner object even when it was `undefined`, and the turn-error / max-tokens views passed `continueAgent={running ? undefined : continueAgent}`. Under `exactOptionalPropertyTypes` that is not a complete owner, so `tsc -b` of downstream client packages (including ui-model-selection) failed.

## Decision

Build the owner with a conditional spread: a missing continuation is omitted, not set to `undefined`. The notice views spread the callback only when the session is not running and a continuation exists.

## Alternatives considered

**Widen `continueAgent` to `(() => void) | undefined`.** Rejected: the slot comment already defines omission as "the view cannot continue"; the BotForge worker rows taught the same omit-vs-undefined split.

**Keep assigning `undefined` and skip client `tsc -b`.** Rejected: plugin bundles compile from that emit, so the live `/plugins/*/client.js` cannot rebuild.

## Consequences

A running session still hides Continue on the turn notices. A stopped session still shows it. Client project references typecheck again.

## Testing

`packages/client/ui-conversation/tests/chat-view.client.spec.tsx` still clicks Continue on a terminal turn failure. `tsc -b packages/client/ui-model-selection/tsconfig.json` is green.

## Related

[BotForge worker normalize](2026-09-05-botforge-normalize-worker-required-fields.md) owns the same exactOptionalPropertyTypes omit-vs-undefined rule on stored rows.
