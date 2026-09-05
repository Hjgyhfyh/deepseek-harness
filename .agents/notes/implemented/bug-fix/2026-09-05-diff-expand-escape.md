# Agent Note: DiffBlock expand Escape collapse and hover color on focus

Status: implemented

English | [中文](2026-09-05-diff-expand-escape.zh.md)

## Problem

A capped `DiffBlock` revealed the hidden middle only on click. Escape did nothing, so the next keystroke could close a dialog or Settings while the full diff stayed open. Keyboard focus used the product ring but kept the idle tertiary color, so it did not match hover.

## Decision

Escape on an expanded cap (`preventDefault`) collapses the middle and leaves focus on the control. A collapsed control ignores the key. A nested control that already handled the key (`defaultPrevented`) leaves the cap expanded. Keyboard focus paints the expand control in the same secondary color as hover. The ring stays on `:focus-visible`.

## Alternatives considered

**Put the expanded cap on the overlay Escape stack.** Rejected: it is an in-flow slice on the card, not a layer. A document subscriber would steal Escape from Settings or a dialog whenever a long diff happened to be expanded.

**Leave the color tertiary on focus and rely on the ring alone.** Rejected: hover already promotes the label to secondary. Keyboard focus that keeps the idle color looks like the pointer missed the control.

**Collapse SearchBlock in the same change.** Rejected: that card owns its expand control. It can follow the same pattern TerminalBlock, ReadBlock, and DiffBlock already proved.

## Consequences

Keyboard users close a long file mutation with Escape and keep focus on the cap control; a second Escape still belongs to whatever overlay is on top. Tab to the expand control looks like hover.

## Testing

`packages/client/ui-primitives/tests/diff-block.client.spec.tsx` pins collapse-on-Escape, collapsed-control ignore, and that a `defaultPrevented` Escape leaves the cap expanded. `packages/client/ui-primitives/tests/diff-block-styles.client.spec.ts` pins the hover/focus color pairing and the existing ring.

## Related

[TerminalBlock expand Escape](2026-09-05-terminal-expand-escape.md) and [ReadBlock expand Escape](2026-09-05-read-expand-escape.md) own the same pattern on command output and file windows. [Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists Diff expand rings.
