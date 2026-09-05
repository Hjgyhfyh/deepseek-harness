# Agent Note: GoalBar edit Escape from save/cancel and icon focus color

Status: implemented

English | [中文](2026-09-05-goalbar-edit-escape.zh.md)

## Problem

GoalBar's inline edit form cancelled on Escape only from the objective field. Tabbing to save or cancel left Escape unused, so the next keystroke hit the composer or an overlay instead of leaving the form. Icon actions used the product ring on `:focus-visible` but kept the idle tertiary color and transparent fill, so keyboard focus did not match hover.

## Decision

The edit dock handles Escape (`preventDefault`) and calls the same leave-edit path as the field and the cancel button, restoring focus to Edit. Idle pause/edit/clear ignore the key so overlays can still take it. Keyboard focus paints the icons in the same secondary color and hover fill as pointer hover. The ring stays on `:focus-visible`.

## Alternatives considered

**Put the edit form on the overlay Escape stack.** Rejected: it is an in-flow composer-stack strip, not a layer. A document subscriber would steal Escape from Settings or a menu whenever a goal happened to be in edit.

**Leave icon color tertiary on focus and rely on the ring alone.** Rejected: hover already promotes the icon to secondary with the interactive fill. Keyboard focus that keeps the idle color looks like the pointer missed the control.

**Cancel only from the field and teach users to Tab back.** Rejected: save and cancel are the next tab stops after the field; Escape there should mean the same as Escape in the field.

## Consequences

Keyboard users leave an in-progress goal edit with Escape from the field, save, or cancel and land on Edit. A second Escape still reaches an overlay. Tab to an icon looks like hover.

## Testing

`packages/client/ui-goal/tests/goalbar.client.spec.tsx` pins field Escape, save/cancel Escape, and idle-action ignore. `packages/client/ui-goal/tests/goalbar-styles.client.spec.ts` pins the hover/focus color pairing and the existing ring.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists the GoalBar icon ring.
