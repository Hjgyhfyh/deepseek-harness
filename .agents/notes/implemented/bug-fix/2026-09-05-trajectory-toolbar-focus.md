# Agent Note: Trajectory toolbar empty-search Escape and control focus color

Status: implemented

English | [中文](2026-09-05-trajectory-toolbar-focus.zh.md)

## Problem

Ledger search cleared a query with `preventDefault`, then a second Escape only blurred the field. A document overlay listener would take that empty-field key. Duration, Turns, and Calls used the product ring on `:focus-visible` but kept the idle tertiary color and transparent fill, so keyboard focus did not match hover. The fold glyphs stayed tertiary even while the label went primary.

## Decision

Search Escape always `preventDefault`s. A non-empty query still writes `''` and keeps focus; an empty field blurs. Keyboard focus paints Duration, Turns, and Calls in the same primary color and hover fill as pointer hover. Fold glyphs inherit that label color on hover and focus. The ring stays on `:focus-visible`.

## Alternatives considered

**Leave empty-field Escape un-prevented so the timeline track can clear a range.** Rejected: the search field is not an ancestor of the track; bubbling is not how range Escape runs. A document overlay would close on the same keystroke as leaving search.

**Leave control color tertiary on focus and rely on the ring alone.** Rejected: hover already promotes the label to primary with the interactive fill. Keyboard focus that keeps the idle color looks like the pointer missed the control.

**Paint the fold glyphs independently of the label.** Rejected: the ⊞/⊟ sit in the same chip as Turns/Calls. A gray glyph beside a primary label looks like a disabled half of the control.

## Consequences

One Escape restores the full ledger. A second Escape leaves the field without dismissing an overlay. Tab to Duration, Turns, or Calls looks like hover, including the fold glyph.

## Testing

`packages/client/ui-trajectory/tests/layout.client.spec.tsx` pins clear-then-blur and that both Escapes `preventDefault`. `packages/client/ui-trajectory/tests/toolbar-styles.client.spec.ts` pins the hover/focus color pairing, glyph inherit, and the existing ring.

## Related

[Escape clears trajectory toolbar search](2026-09-05-trajectory-search-escape.md) introduced clear-then-blur. [Plugin inventory empty-search Escape](2026-09-05-plugin-inventory-search-blur-escape.md) is the Settings sibling. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists the toolbar ring.
