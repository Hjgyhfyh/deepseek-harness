# Agent Note: Trajectory thinking Escape collapse and focus color

Status: implemented

English | [中文](2026-09-05-trajectory-thinking-escape.zh.md)

## Problem

Assistant thinking in the Trajectory inspector is an in-flow disclosure behind a Thinking control. Click/Enter opened the chain of thought, but Escape did nothing — keyboard users who expanded it had no collapse gesture short of clicking the control again. The next Escape would then leave the inspector or hit an overlay. The control used the product ring on `:focus-visible` but kept the idle tertiary color, so keyboard focus did not match hover.

## Decision

Escape on an open thinking fold (`preventDefault`) collapses it and restores focus to the Thinking control. A closed fold ignores the key so the ledger and overlays can still take it. Keyboard focus paints the control in the same secondary label color as hover.

## Alternatives considered

**Put the fold on the overlay Escape stack.** Rejected: it is an in-flow inspector disclosure, not a layer. A document subscriber would steal Escape from Settings or a menu while thinking happened to be expanded.

**Leave the label tertiary on focus and rely on the ring alone.** Rejected: hover already promotes the label to secondary. Keyboard focus that keeps the idle color looks like the pointer missed the control.

## Consequences

Keyboard users close thinking with Escape and keep focus on the Thinking control; a second Escape still reaches the ledger or an overlay. Tab to the control looks like hover.

## Testing

`packages/client/ui-trajectory/tests/table.client.spec.tsx` pins closed-fold ignore, open-fold collapse, and toggle focus restore. `packages/client/ui-trajectory/tests/thinking-styles.client.spec.ts` pins the hover/focus color pairing.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [DisclosureRow Escape](2026-09-05-disclosure-row-escape.md) is the shared compact-header collapse. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists the Thinking control ring.
