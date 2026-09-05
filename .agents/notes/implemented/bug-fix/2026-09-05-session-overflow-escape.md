# Agent Note: Workspace session overflow Escape collapse and focus color

Status: implemented

English | [中文](2026-09-05-session-overflow-escape.zh.md)

## Problem

An open Workspace shows five Sessions and a transient **Show more** control for the remainder. Click/Enter revealed the extra rows, but Escape did nothing — keyboard users who expanded the remainder had no collapse gesture short of clicking **Show less**, and the next Escape would hit search or an overlay. The control used the product ring on `:focus-visible` but kept the idle tertiary color, so keyboard focus did not match hover.

## Decision

Escape on an expanded remainder (`preventDefault`) collapses it back to five and leaves focus on the control. A collapsed control ignores the key so search and overlays can still take it. Closing the Workspace still forgets the transient expansion. Keyboard focus paints the label in the same secondary color as hover.

## Alternatives considered

**Put the remainder on the overlay Escape stack.** Rejected: it is an in-flow list disclosure in the sidebar, not a layer. A document subscriber would steal Escape from Settings or a menu while any Workspace happened to show extra Sessions.

**Leave the label tertiary on focus and rely on the ring alone.** Rejected: hover already promotes the label to secondary. Keyboard focus that keeps the idle color looks like the pointer missed the control.

**Collapse the whole Workspace group on Escape.** Rejected: that hides the five visible Sessions the user was browsing. The overflow control only owns the extra rows.

## Consequences

Keyboard users close **Show more** with Escape and keep focus on the control; a second Escape still reaches search or an overlay. The Workspace stays open at five Sessions. Tab to the control looks like hover.

## Testing

`packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` pins closed-control ignore, open-remainder collapse without closing the Workspace, and focus remaining on the control. `packages/client/ui-workspace/tests/browser-styles.client.spec.ts` pins the hover/focus color pairing and the existing ring.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists the overflow-button ring.
