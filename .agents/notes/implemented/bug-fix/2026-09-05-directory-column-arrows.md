# Agent Note: Directory-browser column arrows and row/show-hidden focus color

Status: implemented

English | [中文](2026-09-05-directory-column-arrows.zh.md)

## Problem

Miller-column folder rows were pointer-only: Tab reached a row, but ArrowUp/ArrowDown did nothing, so keyboard users had to Tab through every sibling. The show-hidden toggle used the product ring on `:focus-visible` but kept the idle secondary color, and a focused row kept a transparent fill, so keyboard focus did not match hover.

## Decision

ArrowUp and ArrowDown on a focused row (`preventDefault`) move focus and selection to the previous or next row in that column. A row at either end ignores the key. Escape still belongs to the browse modal, path-edit, and nested create. Keyboard focus paints the show-hidden toggle in the same primary color as hover, paints an idle row with the hover fill, and keeps a selected row on its selected fill. The ring stays on `:focus-visible`.

## Alternatives considered

**Steal Escape on the show-hidden toggle to turn the filter off.** Rejected: the toggle lives inside the browse modal. The overlay stack already owns Escape, and turning the filter off with that key would close nothing the user asked to dismiss.

**Move selection without focusing the next row.** Rejected: the next Arrow would still fire on the old row. Focus has to travel with the selection.

**Put column arrows on the overlay Escape stack.** Rejected: arrows are not dismiss. The modal, path-edit, and create dialogs stay on the stack.

## Consequences

Keyboard users step through a column with the arrows and see the same hover fill they get with the pointer. Show-hidden looks like hover when it is the tab stop. Escape still closes path-edit, then create, then the browse dialog.

## Testing

`packages/client/ui-directory-picker-browse/tests/directory-browser.client.spec.tsx` pins ArrowDown/ArrowUp selection, end-of-list ignore, and that other keys do not move. `packages/client/ui-directory-picker-browse/tests/browser-styles.client.spec.ts` pins the hover/focus color pairing and the existing ring.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists directory crumb, row, and show-hidden rings.
