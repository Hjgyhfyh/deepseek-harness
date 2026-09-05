# Agent Note: Queue edit Escape from save/cancel and action focus color

Status: implemented

English | [中文](2026-09-05-queue-edit-escape.zh.md)

## Problem

Queue's inline editor cancelled on Escape only from the field. Tabbing to save or cancel left Escape unused: the dock handler treated any in-progress edit as idle-ignore, so the next keystroke hit the composer or an overlay instead of leaving the draft. Row actions used the product ring on `:focus-visible` but kept the idle tertiary color and transparent fill, so keyboard focus did not match hover.

## Decision

The dock handles Escape while an edit is open (`preventDefault`) and calls the same leave-edit path as the field and the cancel button, restoring focus to Edit and leaving a multi-row list expanded. An in-flight mutation still ignores the key. Keyboard focus paints the actions in the same secondary color and hover fill as pointer hover. The ring stays on `:focus-visible`.

## Alternatives considered

**Put the editor on the overlay Escape stack.** Rejected: it is an in-flow composer-stack strip, not a layer. A document subscriber would steal Escape from Settings or a menu whenever a queue row happened to be in edit.

**Leave action color tertiary on focus and rely on the ring alone.** Rejected: hover already fills the control. Keyboard focus that keeps the idle color looks like the pointer missed the control.

**Collapse the list when Escape arrives from save or cancel.** Rejected: Escape in the editor already means cancel the draft. The same key on the next tab stops must keep that meaning, or the row the user just returned to disappears.

## Consequences

Keyboard users leave an in-progress queue edit with Escape from the field, save, or cancel and land on Edit. A second Escape still collapses an open multi-row list. Tab to a row action looks like hover.

## Testing

`packages/client/ui-conversation/tests/queue-dock.client.spec.tsx` pins field Escape, save/cancel Escape on single-row and multi-row queues, and that the list stays open. `packages/client/ui-conversation/tests/composer-dock-styles.client.spec.ts` pins the hover/focus action color pairing.

## Related

[Composer-dock Escape](2026-09-05-composer-dock-escape.md) owns list collapse. [GoalBar edit Escape](2026-09-05-goalbar-edit-escape.md) is the sibling strip. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists QueueDock action rings.
