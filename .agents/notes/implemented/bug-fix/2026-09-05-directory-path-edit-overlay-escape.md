# Agent Note: Directory path-edit joins the overlay Escape stack

Status: implemented

English | [中文](2026-09-05-directory-path-edit-overlay-escape.zh.md)

## Problem

Path-edit in the workspace directory picker cancelled Escape with `stopPropagation` so the browse Modal's old document listener would not close the dialog. Nested create did the same on its name field. After overlays moved to a LIFO stack, those stops hid Escape from a later dialog and duplicated Modal close. Crumb buttons, Miller rows, and the show-hidden toggle still used the user-agent outline (or none).

## Decision

A child `useOverlayEscape` frame mounts inside the browse Modal while a path draft is open, so Escape collapses the editor first and a later overlay still wins. Nested create Escape is only the nested Modal's stack frame (in-flight create still no-ops `onClose`). Crumbs, rows, and show-hidden use `--dsw-shadow-focus-ring`. Card-scope `blur` still cancels path-edit when focus leaves the dialog.

## Alternatives considered

**Keep `stopPropagation` on the card.** Rejected: it fights the shared stack the same way composer palettes used to, and a later dialog never sees the first Escape.

**Subscribe path-edit from DirectoryBrowser's body hooks.** Rejected: that would stack under the browse Modal (parent hooks run before child Modal hooks), so Escape would close the dialog first.

## Consequences

Keyboard users can abandon a typed path without dismissing the picker, then dismiss the picker with a second Escape. A dialog opened on top of path-edit takes the first Escape. Tabbed crumbs and folder rows match the product ring.

## Testing

`packages/client/ui-directory-picker-browse/tests/directory-browser.client.spec.tsx` still pins input/row Escape, nested-create LIFO, and in-flight create; it now also pins later-overlay deferral. `packages/client/ui-directory-picker-browse/tests/browser-styles.client.spec.ts` pins the ring on crumbs, rows, show-hidden, and the create field.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
