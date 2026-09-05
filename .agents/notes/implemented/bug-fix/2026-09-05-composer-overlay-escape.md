# Agent Note: Composer slash and command palettes join the overlay Escape stack

Status: implemented

English | [中文](2026-09-05-composer-overlay-escape.zh.md)

## Problem

Slash suggestions and the command `popupSelect` shell handled Escape only on the composer subtree (textarea `dismissPopup`, card `onKeyDown`). A later dialog on the shared stack never saw the first Escape, and after that dialog closed the palette stayed up. Slash option rows were real tab stops, so Tab left the combobox textarea. Highlighted slash rows also used the user-agent outline (or none) instead of the product ring.

## Decision

`MenuView` and `PopupSelectView` subscribe through `useOverlayEscape` while their card is showing. The command shell unsubscribes while a `RiskConfirmation` Modal is up so that confirmation is the top frame. Slash option buttons use `tabIndex={-1}`. Active and `:focus-visible` slash rows use `--dsw-shadow-focus-ring`.

## Alternatives considered

**Keep slash Escape on the textarea only.** Rejected: Tab into a row, or Escape after a dialog, would not dismiss the list.

**`stopPropagation` on the command-card Escape.** Rejected: it would hide the event from the stack instead of participating in it, and the confirmation Modal would still race the card if both listened.

## Consequences

Escape dismisses one composer overlay at a time. A risk confirmation in `popupSelect` closes first. Tab stays in the slash textarea. Keyboard highlight on slash rows matches the command palette ring.

## Testing

`packages/client/ui-input-trigger/tests/menu-view.client.spec.tsx` pins `tabIndex={-1}` and that a later stack frame wins Escape. `packages/client/ui-commands/tests/popup-view.client.spec.tsx` still dismisses from the search field and pins the later-overlay case.

## Related

[Header popovers join the overlay Escape stack](2026-09-05-header-overlay-escape.md) owns the same subscribe pattern on session-header actions. [Overlay Escape is a LIFO stack](2026-09-05-overlay-escape-stack.md) owns the shared listener.
