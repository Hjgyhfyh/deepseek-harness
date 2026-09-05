# Agent Note: Retry Escape collapse and in-flow Continue ring

Status: implemented

English | [中文](2026-09-05-retry-escape-and-continue-ring.zh.md)

## Problem

The model-retry row is a native `<details>` disclosure. Enter/click opened the delay and failure body, but Escape did nothing — keyboard users who opened it had no collapse gesture. The in-flow Continue chip on turn-error and max-tokens rows was a pointer-only looking control: `cursor: pointer`, no hover fill, and no product `:focus-visible` ring, unlike the composer Continue.

## Decision

Escape on the retry `<details>` collapses an open row (`preventDefault`) and restores focus to the summary. A closed row ignores the key so a later overlay can still take it. The in-flow Continue chip uses `--dsw-shadow-focus-ring` and a hover fill.

## Alternatives considered

**Put the retry row on the overlay Escape stack.** Rejected: it is an in-flow transcript disclosure, not a layer. A document subscriber would steal Escape from a dialog opened while a retry row happened to be expanded.

**Restyle the chip to match composer Continue.** Rejected: the composer control is a 28px pill in the input chrome; the transcript chip is a compact bordered resume affordance next to the status copy. The ring and hover fill are the leftover keyboard/pointer chrome, not a geometry rewrite.

## Consequences

Keyboard users close retry details with Escape and keep focus on the summary. Tab to Continue after a failed or capped turn shows the product ring. A settings overlay still wins the first Escape because the row only handles the key while it holds focus.

## Testing

`packages/client/ui-conversation/tests/chat-view.client.spec.tsx` pins closed-row ignore, open-row collapse, and summary focus restore. `packages/client/ui-conversation/tests/message-item-styles.client.spec.ts` pins the Continue hover fill and ring.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [DisclosureRow Escape](2026-09-05-disclosure-row-escape.md) is the shared compact-header collapse. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
