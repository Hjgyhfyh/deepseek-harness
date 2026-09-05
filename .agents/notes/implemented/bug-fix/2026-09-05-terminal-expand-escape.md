# Agent Note: TerminalBlock expand Escape collapse and hover color on focus

Status: implemented

English | [中文](2026-09-05-terminal-expand-escape.zh.md)

## Problem

A capped `TerminalBlock` revealed the hidden middle only on click. Escape did nothing, so the next keystroke could close a dialog or Settings while the full output stayed open. Keyboard focus used the product ring but kept the idle tertiary color, so it did not match hover.

## Decision

Escape on an expanded cap (`preventDefault`) collapses the middle and leaves focus on the control. A collapsed control ignores the key. A nested control that already handled the key (`defaultPrevented`) leaves the cap expanded. Keyboard focus paints the expand control in the same secondary color as hover. The ring stays on `:focus-visible`.

## Alternatives considered

**Put the expanded cap on the overlay Escape stack.** Rejected: it is an in-flow slice on the card, not a layer. A document subscriber would steal Escape from Settings or a dialog whenever a long command happened to be expanded.

**Leave the color tertiary on focus and rely on the ring alone.** Rejected: hover already promotes the label to secondary. Keyboard focus that keeps the idle color looks like the pointer missed the control.

**Collapse ReadBlock, DiffBlock, and SearchBlock in the same change.** Rejected: each card owns its expand control. Those siblings can follow once this pattern is proven on the original height-cap owner.

## Consequences

Keyboard users close a long command's full output with Escape and keep focus on the cap control; a second Escape still belongs to whatever overlay is on top. Tab to the expand control looks like hover.

## Testing

`packages/client/ui-primitives/tests/terminal-block.client.spec.tsx` pins collapse-on-Escape, collapsed-control ignore, and that a `defaultPrevented` Escape leaves the cap expanded. `packages/client/ui-primitives/tests/terminal-block-styles.client.spec.ts` pins the hover/focus color pairing and the existing ring.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists Terminal expand rings.
