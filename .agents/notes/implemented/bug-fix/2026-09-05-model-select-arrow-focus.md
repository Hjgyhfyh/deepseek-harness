# Agent Note: ModelSelect opening focus and ArrowDown skip

Status: implemented

English | [中文](2026-09-05-model-select-arrow-focus.zh.md)

## Problem

`ModelSelect.moveFocus` treated a missing active row as index `0` and then added the arrow offset, so the first ArrowDown from the trigger skipped the first row. Opening left focus on the trigger. Root `.cell` rows and the in-menu Retry control had no product focus ring.

## Decision

When no row is focused, ArrowDown lands on the first enabled item and ArrowUp on the last. Opening or drilling a pane focuses the `aria-checked` radio if one exists, otherwise the first enabled row. `.cell:focus-visible` and `.retry:focus-visible` use `--dsw-shadow-focus-ring`.

## Alternatives considered

**Keep focus on the trigger and only fix the `-1` index math.** Rejected: a mouse-opened menu still leaves keyboard users on the chip until they press an arrow.

**Roving tabindex.** Rejected: the list is short and already a `role="menu"`; `focus()` matches the Menu primitive.

## Consequences

A click-opened model menu is arrow-navigable from the first row. Drilling into models or efforts lands on the current selection. Retry in the load-error strip shows the same ring as other chrome.

## Testing

`packages/client/ui-model-selection/tests/model-select.client.spec.tsx` pins trigger ArrowDown/Up, wrap between Model and Effort, and focusing the current model radio after drill-in.

## Related

[Menu keyboard focus](2026-09-05-menu-keyboard-focus.md) owns the same open-and-arrow pattern on the shared Menu primitive. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
