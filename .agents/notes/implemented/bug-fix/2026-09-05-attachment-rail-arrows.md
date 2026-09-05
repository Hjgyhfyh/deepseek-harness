# Agent Note: Attachment-rail thumbnail arrows and paging-arrow focus fill

Status: implemented

English | [中文](2026-09-05-attachment-rail-arrows.zh.md)

## Problem

Draft-image thumbnails were pointer-only for neighbor travel: Tab reached a card, but ArrowLeft/ArrowRight did nothing, so keyboard users had to Tab through every thumbnail and its remove control. Paging arrows used the product ring on `:focus-visible` but kept the idle fill, so keyboard focus did not match hover. Thumbnails themselves had no product ring.

## Decision

ArrowLeft and ArrowRight on a focused thumbnail or remove control (`preventDefault`) move focus to the same control on the previous or next item and scroll it into view. An item at either end ignores the key. Keyboard focus paints the paging arrows in the same solid hover fill as pointer hover. Thumbnails use `--dsw-shadow-focus-ring` on `:focus-visible`. Escape still belongs to the composer popup stack and the lightbox.

## Alternatives considered

**Page the rail by viewport on ArrowLeft/ArrowRight.** Rejected: that skips cards. Neighbor travel plus `scrollIntoView` lands on the next image, which is what the key asked for.

**Put the rail on the overlay Escape stack.** Rejected: arrows are not dismiss. The lightbox and composer popups stay on the stack.

**Leave paging arrows idle on focus and rely on the ring alone.** Rejected: hover already seats the solid fill. Keyboard focus that keeps the idle fill looks like the pointer missed the control.

## Consequences

Keyboard users step through draft images with the arrows and see the same hover fill on the paging controls. A thumbnail that is the tab stop shows the product ring. Escape still closes an open lightbox or composer popup.

## Testing

`packages/client/ui-attachment/tests/attachment-rail.client.spec.tsx` pins ArrowLeft/ArrowRight on thumbnails and remove, end-of-rail ignore, and that other keys do not move. `packages/client/ui-attachment/tests/attachment-rail-styles.client.spec.ts` pins the thumbnail/remove/arrow rings and the arrow hover/focus fill pairing.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) lists AttachmentRail thumbnail, remove, and arrow rings.
