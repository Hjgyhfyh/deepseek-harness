# Agent Note: DisclosureRow Escape collapses in-flow rows

Status: implemented

English | [中文](2026-09-05-disclosure-row-escape.zh.md)

## Problem

Think, context-injection, tool, command, and workflow rows share `DisclosureRow`. Enter/Space toggled a whole-row disclosure, but Escape did nothing — keyboard users who opened the body had no collapse gesture. The hover chevron stayed pointer-only, so a focused header kept the rest icon.

## Decision

Escape on the disclosure root collapses an open expandable row (`preventDefault`) and restores focus to the header (the whole-row target, or the leading button when that is the control). Closed rows and forced-open `expandable={false}` rows ignore Escape so a later overlay can still take the key. The hover chevron also shows on `:focus-visible` for the row and the leading button.

## Alternatives considered

**Put DisclosureRow on the overlay Escape stack.** Rejected: these are in-flow transcript rows, not layers. A document subscriber would steal Escape from a dialog opened while a Think row happened to be expanded.

**Call `onToggle` on Escape even when closed.** Rejected: that would expand a collapsed row from a key that means dismiss everywhere else.

## Consequences

Keyboard users close Think, context, tool, command, and workflow disclosures with Escape and keep focus on the summary. Inspect-style nested buttons bubble the same collapse. A settings overlay still wins the first Escape because the row only handles the key while it holds focus.

## Testing

`packages/client/ui-primitives/tests/disclosure-row.client.spec.tsx` pins Enter/Space, closed-row ignore, open-row collapse, nested-control restore, leading-button collapse, and forced-open inert Escape. `packages/client/ui-primitives/tests/disclosure-row-styles.client.spec.ts` pins the focus chevron and the existing header ring.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Skill row Escape](2026-09-05-skill-row-escape.md) is the dedicated skill toolview fork of this chrome. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
