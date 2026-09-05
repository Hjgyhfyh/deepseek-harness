# Agent Note: Plugin configuration nested Escape skip and chevron/discard focus color

Status: implemented

English | [中文](2026-09-05-plugin-card-nested-escape.zh.md)

## Problem

Configurable plugin cards collapse on any bubbling Escape while open. A nested control that already handled the key (`preventDefault`) still closed the card, so a select, search, or overlay inside the form could not keep its own dismiss. The header chevron darkened on keyboard focus but stayed tertiary on hover. Discard used the product ring on `:focus-visible` but kept the idle secondary color, so keyboard focus did not match hover.

## Decision

The card handler skips `event.defaultPrevented`, then `preventDefault`s and collapses as before. Hover paints the chevron in the same secondary color as header `:focus-visible`. Discard keyboard focus paints the label primary with the hover border. The ring stays on Discard/Save `:focus-visible`.

## Alternatives considered

**Keep collapsing even after a nested preventDefault.** Rejected: that steals the key from a control that already used it. Timeout and other idle fields still bubble, so Escape from those still closes the card.

**Leave the chevron tertiary on hover and Discard idle on focus.** Rejected: keyboard focus already promotes the glyph, and hover already promotes Discard. The mismatched state looks like the pointer missed the control.

## Consequences

A nested control can spend Escape on itself without collapsing the card. An unhandled Escape from a field still closes the card and restores header focus. Tab or hover on the header darkens the chevron the same way. Tab to Discard looks like hover.

## Testing

`packages/client/ui-settings-plugins/tests/section.client.spec.tsx` pins nested-field collapse and that a `defaultPrevented` Escape leaves the card open. `packages/client/ui-settings-plugins/tests/plugin-card-styles.client.spec.ts` pins the hover/focus chevron and Discard color pairing.

## Related

[Plugin configuration Escape](2026-09-05-plugin-card-escape.md) owns open-card collapse. [Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists plugin-card rings.
