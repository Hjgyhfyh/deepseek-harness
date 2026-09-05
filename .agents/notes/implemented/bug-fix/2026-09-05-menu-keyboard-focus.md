# Agent Note: Menu keyboard focus and arrow navigation

Status: implemented

English | [中文](2026-09-05-menu-keyboard-focus.zh.md)

## Problem

Open `Menu` lists only closed on Escape and outside pointerdown. Focus stayed on the trigger. Arrow keys did nothing. Menuitems are real buttons, so Tab could reach them, but there was no list navigation and no product focus ring on `.item`.

## Decision

While `open`, a document `keydown` listener moves among `button[role="menuitem"]:not([disabled])` on ArrowUp/Down and wraps. Opening focuses the selected enabled row via `data-menu-id`, or the first enabled row. `.item:focus-visible` uses `--dsw-shadow-focus-ring`.

## Alternatives considered

**Roving tabindex on each item.** Rejected: the list is short and already a single `role="menu"`; document arrows plus `focus()` is enough.

**Leave focus on the trigger and only handle arrows if the list contains focus.** Rejected: opening from a mouse click still leaves keyboard users outside the list.

## Consequences

JsonTree context menus and workspace overflow menus receive focus on open. Arrow keys skip disabled and label rows. Existing click tests still work.

## Testing

`packages/client/ui-primitives/tests/atoms.client.spec.tsx` pins selected-row focus, wrap-around arrows, ArrowUp/Down with no focused row, a label-only list, and ArrowDown while a portal list has no rect.

## Related

[Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token used on menuitems and the leftover trajectory/plan/retry/disclosure chrome aligned in the same change.
