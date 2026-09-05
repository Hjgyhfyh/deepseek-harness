# Agent Note: Compaction-marker Escape collapse and hover fill on focus

Status: implemented

English | [中文](2026-09-05-compaction-marker-escape.zh.md)

## Problem

The compaction checkpoint marker disclosed its summary on click only. Escape did nothing, so the next keystroke could close a dialog or Settings while the summary stayed open. Keyboard focus used the product ring but kept a transparent fill, so it did not match hover.

## Decision

Escape on an open marker (`preventDefault`) collapses the summary and restores focus to the button. A closed marker ignores the key. A nested control that already handled the key (`defaultPrevented`) leaves the summary open. Keyboard focus paints the marker in the same hover fill as the pointer. The ring stays on `:focus-visible`.

## Alternatives considered

**Put the open summary on the overlay Escape stack.** Rejected: it is an in-flow disclosure in the transcript, not a layer. A document subscriber would steal Escape from Settings or a dialog whenever a compaction happened to be expanded.

**Leave the fill transparent on focus and rely on the ring alone.** Rejected: hover already seats the fill, and hover/focus already swap the disclosure glyph. Keyboard focus that keeps a transparent fill looks like the pointer missed the control.

**Collapse from the button only, not the row.** Rejected: the summary body can hold markdown links. Escape from those has to reach the same handler.

## Consequences

Keyboard users close a compaction summary with Escape and keep focus on the marker; a second Escape still belongs to whatever overlay is on top. Tab to the marker looks like hover.

## Testing

`packages/client/ui-conversation/tests/compaction-item.client.spec.tsx` pins collapse-on-Escape with focus restore, closed-marker ignore, and that a `defaultPrevented` Escape leaves the summary open. `packages/client/ui-conversation/tests/message-item-styles.client.spec.ts` pins the hover/focus fill pairing and the existing ring.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists the compaction-marker ring.
