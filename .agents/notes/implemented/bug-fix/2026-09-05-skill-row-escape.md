# Agent Note: Skill row Escape collapses and rings leftover chrome

Status: implemented

English | [中文](2026-09-05-skill-row-escape.zh.md)

## Problem

The dedicated skill tool row is a whole-row disclosure with Enter/Space, but Escape did nothing — keyboard users who opened the instructions card had no collapse gesture short of Tabbing away and clicking. Inspect stayed `opacity: 0` until hover, so Tab landed on an invisible control. The expandable header used the user-agent outline or none; Inspect's `:focus-visible` only unhid the button.

## Decision

Escape on the card collapses an open row (`preventDefault`) and restores focus to the header, including when Inspect holds focus. A closed row ignores Escape so a later overlay can still take the key. The header uses `--dsw-shadow-focus-ring` and shows the hover chevron on `:focus-visible`. Inspect stays visible while the card contains focus and uses the product ring.

## Alternatives considered

**Put the row on the overlay Escape stack.** Rejected: it is an in-flow disclosure, not a layer. A document subscriber would steal Escape from a dialog opened while a skill row happened to be expanded.

**Leave Inspect hidden until it is focused.** Rejected: Tab would move into an invisible control. Showing it on `:focus-within` matches hover without painting it on every collapsed row.

## Consequences

Keyboard users can close instructions with Escape and keep focus on the summary. Inspect is visible whenever the card is the keyboard context. A settings overlay still wins the first Escape because the row only handles the key while it (or Inspect) is focused.

## Testing

`packages/client/ui-skill/tests/skill-row.client.spec.tsx` pins closed-row ignore, open-row collapse, and Inspect Escape restoring header focus. `packages/client/ui-skill/tests/skill-row-styles.client.spec.ts` pins both rings.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token. The compact header chrome copies DisclosureRow; Escape stays local to this toolview.
