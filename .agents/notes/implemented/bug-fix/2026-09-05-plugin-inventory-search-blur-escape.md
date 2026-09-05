# Agent Note: Plugin inventory empty-search Escape and chevron hover color

Status: implemented

English | [中文](2026-09-05-plugin-inventory-search-blur-escape.zh.md)

## Problem

Plugin-list catalog search cleared a query with `preventDefault`, then a second Escape only blurred the field. The overlay stack is a document bubble listener, so that empty-field key also closed Settings. The card chevron darkened on keyboard focus but stayed tertiary on hover, so pointer and keyboard did not match.

## Decision

Search Escape always `preventDefault`s. A non-empty query still writes `''` and keeps focus; an empty field blurs. Settings can take the next key after the field has left. Hover paints the chevron in the same secondary color as `:has(.cardContent:focus-visible)`.

## Alternatives considered

**Leave empty-field Escape un-prevented so SettingsRoot owns the key.** Rejected: that closes Settings on the same keystroke as leaving search. The inventory tab is not the overlay owner; it must not yield the key until the field has blurred.

**Keep the chevron tertiary on hover and rely on the header fill.** Rejected: keyboard focus already promotes the glyph. Hover that keeps the idle color looks like the pointer missed the control.

## Consequences

One Escape restores the full catalog. A second Escape leaves the field without dismissing Settings. A third Escape still closes Settings. Tab or hover on a card darkens the chevron the same way.

## Testing

`packages/client/ui-settings-plugin-inventory/tests/components.client.spec.tsx` pins clear-then-blur and that both Escapes `preventDefault`. `packages/client/ui-settings-plugin-inventory/tests/inventory-card-styles.client.spec.ts` pins the hover/focus chevron color pairing.

## Related

[Escape clears plugin inventory search](2026-09-05-plugin-inventory-search-escape.md) introduced clear-then-blur. [Plugin inventory card Escape](2026-09-05-plugin-inventory-card-escape.md) owns disclosure collapse. [Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays.
