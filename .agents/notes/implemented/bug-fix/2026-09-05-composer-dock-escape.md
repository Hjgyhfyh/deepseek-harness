# Agent Note: Composer-dock Escape collapse and chevron focus color

Status: implemented

English | [中文](2026-09-05-composer-dock-escape.zh.md)

## Problem

The Todo plan strip and the multi-row Queue dock above the composer are in-flow disclosures. Click/Enter opened the list, but Escape did nothing — keyboard users who expanded a plan or tabbed into a queue action had no collapse gesture short of clicking the header again. Queue-row Escape while idle would also fail to return to the count header. Both chevrons used the product ring on `:focus-visible` but kept the idle tertiary color, so keyboard focus did not match hover.

## Decision

Escape on an open dock (`preventDefault`) collapses it and restores focus to the header, including from a Queue row action. A closed dock ignores the key so an overlay (Settings, a menu) can still take it. Queue's inline editor already `preventDefault`s Escape to cancel the edit; the dock handler skips `event.defaultPrevented` so that gesture stays edit-only. A single-row queue has no count header, so it does not collapse. Keyboard focus paints each chevron in the same primary label color as hover.

## Alternatives considered

**Put each dock on the overlay Escape stack.** Rejected: these are in-flow composer strips, not layers. A document subscriber would steal Escape from Settings or a menu while a dock happened to be expanded.

**Leave the chevron tertiary on focus and rely on the ring alone.** Rejected: hover already promotes the glyph to primary. Keyboard focus that keeps the idle color looks like the pointer missed the control.

**Collapse a Queue that is mid-edit.** Rejected: Escape in the editor already means cancel the draft. Collapsing on the same key would hide the row the user just returned to.

## Consequences

Keyboard users close an open Todo or Queue dock with Escape and keep focus on its header; a second Escape still dismisses an overlay. Cancelling a queue edit still leaves the list open. Tab to a dock header looks like hover.

## Testing

`packages/client/ui-conversation/tests/todo-panel.client.spec.tsx` pins closed-strip ignore, open-plan collapse, and header focus restore. `packages/client/ui-conversation/tests/queue-dock.client.spec.tsx` pins the same for the count header, collapse from a row action, and that editor Escape still only cancels. `packages/client/ui-conversation/tests/composer-dock-styles.client.spec.ts` pins the hover/focus chevron color pairing.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Retry Escape](2026-09-05-retry-escape-and-continue-ring.md) is the transcript `<details>` sibling. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists TodoPanel and QueueDock header rings.
