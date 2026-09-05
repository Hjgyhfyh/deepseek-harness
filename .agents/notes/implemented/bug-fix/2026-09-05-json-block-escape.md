# Agent Note: JsonBlock Escape collapse and hover fill on focus

Status: implemented

English | [中文](2026-09-05-json-block-escape.zh.md)

## Problem

`JsonBlock` disclosed unknown or leftover payloads on click only. Escape did nothing, so the next keystroke could close a dialog or Settings while the JSON stayed open. Keyboard focus used the product ring but kept a transparent fill, so it did not match hover.

## Decision

Escape on an open block (`preventDefault`) collapses the body and restores focus to the toggle. A closed block ignores the key. A nested control that already handled the key (`defaultPrevented`) leaves the body open. Keyboard focus paints the toggle in the same hover fill as the pointer. The ring stays on `:focus-visible`. The toggle reports `aria-expanded`.

## Alternatives considered

**Put the open block on the overlay Escape stack.** Rejected: it is an in-flow extras fold in the transcript, not a layer. A document subscriber would steal Escape from Settings or a dialog whenever a leftover payload happened to be expanded.

**Leave the fill transparent on focus and rely on the ring alone.** Rejected: hover already seats the fill. Keyboard focus that keeps a transparent fill looks like the pointer missed the control.

**Collapse JsonTree the same way.** Rejected: a tree already uses ArrowLeft to close a node. Escape there would fight that vocabulary.

## Consequences

Keyboard users close leftover JSON with Escape and keep focus on the toggle; a second Escape still belongs to whatever overlay is on top. Tab to the toggle looks like hover.

## Testing

`packages/client/ui-primitives/tests/markdown.client.spec.tsx` pins collapse-on-Escape with focus restore, closed-block ignore, and that a `defaultPrevented` Escape leaves the body open. `packages/client/ui-primitives/tests/json-block-styles.client.spec.ts` pins the hover/focus fill pairing and the existing ring.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists the JsonBlock-toggle ring.
