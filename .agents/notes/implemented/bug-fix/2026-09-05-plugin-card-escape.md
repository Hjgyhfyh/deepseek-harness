# Agent Note: Plugin configuration Escape collapse and card focus ring

Status: implemented

English | [中文](2026-09-05-plugin-card-escape.zh.md)

## Problem

Configurable plugin cards are in-place disclosures with nested fields. Click/Enter opened the form, but Escape did nothing — keyboard users who opened a card or tabbed into a field had no collapse gesture short of clicking the header again, and the next Escape would close Settings. The product ring sat on the inner header button, so an open card being edited (focus in a field) showed no ring around the tile being worked on. The chevron stayed tertiary on keyboard focus.

## Decision

Escape on an open card (`preventDefault`) collapses it and restores focus to the header, including when a nested field holds focus. A closed card ignores the key so the Settings overlay can still take it. Staged edits outlive collapsing, as they already did for click-collapse. The product ring paints on `.card:focus-within` rather than the header, and the chevron darkens on header `:focus-visible`.

## Alternatives considered

**Put each card on the overlay Escape stack.** Rejected: these are in-flow catalog disclosures inside Settings, not layers. A document subscriber would steal Escape from Settings while any card happened to be expanded, or fight the settings frame for the first key.

**Leave the ring on the header.** Rejected: once the user tabs into a timeout field, the header is no longer focused and the tile they are editing would go unringed. `focus-within` on the card follows the work.

## Consequences

Keyboard users close a plugin card with Escape from the header or a nested field and keep focus on the header; a second Escape still dismisses Settings. Tab into an open card shows the product ring around the whole tile. Discard/Save keep their own rings.

## Testing

`packages/client/ui-settings-plugins/tests/section.client.spec.tsx` pins closed-card ignore, open-card collapse from a nested field, and header focus restore. `packages/client/ui-settings-plugins/tests/plugin-card-styles.client.spec.ts` pins the card ring and the header chevron.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Plugin inventory card Escape](2026-09-05-plugin-inventory-card-escape.md) is the read-only catalog sibling. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists plugin-card rings.
