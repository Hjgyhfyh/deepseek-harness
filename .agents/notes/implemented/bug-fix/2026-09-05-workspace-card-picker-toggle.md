# Agent Note: No-workspace composer card toggles the picker

Status: implemented

English | [中文](2026-09-05-workspace-card-picker-toggle.zh.md)

## Problem

The dashed composer card is the pick-a-workspace target when no workspace is current. It stops `pointerdown` so the Menu's outside-close cannot race a reopen, which also means a second click never reaches the document. `onRequestWorkspace` only set the picker open, so a second click or Enter left it stuck. The hero chip next to it already toggled. Hover painted the dash business-blue; keyboard focus and an open picker did not.

## Decision

ConversationRoot toggles `pickerOpen` from the card, matching the chip. The dash uses `--dsw-alias-state-business-primary` on `:hover`, `:focus-within`, and `:has(textarea[aria-expanded='true'])`. The card still traps `pointerdown`; Escape stays on the overlay stack via the Menu.

## Alternatives considered

**Keep open-only and rely on outside-close.** Rejected: the card's `pointerdown` trap is required to avoid close-then-open flicker, so outside-close never sees the second click.

**Toggle inside InputBar from `workspacePickerOpen`.** Rejected: the owner already owns `pickerOpen` for the chip and the slot; a second boolean in the bar would drift.

## Consequences

A second click or Enter on the dashed card closes the picker. Keyboard focus and an open menu show the same blue dash as hover. The chip and the card stay one control.

## Testing

`packages/client/ui-conversation/tests/skeleton.client.spec.tsx` pins card toggle and chip-then-card close. `packages/client/ui-conversation/tests/input-bar-styles.client.spec.ts` pins the three dash selectors. InputBar still spies `onRequestWorkspace` as a fire-and-forget callback.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns Menu Escape. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the card's existing `:focus-within` ring.
