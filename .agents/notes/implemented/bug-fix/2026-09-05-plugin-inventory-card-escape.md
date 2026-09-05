# Agent Note: Plugin inventory Escape collapse and unclipped card ring

Status: implemented

English | [中文](2026-09-05-plugin-inventory-card-escape.zh.md)

## Problem

Plugin-list catalog cards are in-place disclosures. Click/Enter opened the Loader id and status body, but Escape did nothing — keyboard users who opened a card had no collapse gesture short of clicking again, and the next Escape would close Settings instead. The product ring was on the inner header button, which the card's `overflow: hidden` clips.

## Decision

Escape on an open card (`preventDefault`) collapses it and restores focus to the header. A closed card ignores the key so the Settings overlay can still take it. The focus ring paints on the card via `:has(.cardContent:focus-visible)`, including while open, so clipping cannot hide it. The chevron darkens on that same keyboard focus.

## Alternatives considered

**Put each card on the overlay Escape stack.** Rejected: these are in-flow catalog disclosures inside Settings, not layers. A document subscriber would steal Escape from Settings while any card happened to be expanded, or fight the settings frame for the first key.

**Keep the ring on the inner button and drop `overflow: hidden`.** Rejected: the clip is what rounds the open-state detail body to the card radius. Moving the ring to the card keeps the clip.

## Consequences

Keyboard users close a plugin card with Escape and keep focus on its header; a second Escape still dismisses Settings. Tab to a card shows the product ring around the whole tile. Search-field Escape (clear, then blur) is unchanged.

## Testing

`packages/client/ui-settings-plugin-inventory/tests/components.client.spec.tsx` pins closed-card ignore, open-card collapse, and header focus restore. `packages/client/ui-settings-plugin-inventory/tests/inventory-card-styles.client.spec.ts` pins the card ring and that the inner button no longer paints one.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [DisclosureRow Escape](2026-09-05-disclosure-row-escape.md) is the shared compact-header collapse. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists inventory-card rings.
