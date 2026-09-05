# Agent Note: Approval Escape joins the overlay stack

Status: implemented

English | [中文](2026-09-05-approval-overlay-escape.zh.md)

## Problem

The composer approval takeover had Refuse and Allow, but Escape did nothing. Keyboard users reading a long command could not dismiss the wait the way a dialog cancel would. The justification/command region is already a `tabIndex={0}` group so the tail can be reached, and it used the user-agent outline or none.

## Decision

Escape refuses the wait — the Reject button's `rejected` outcome, never Allow — through the overlay stack. The stack unsubscribes while a decision is in flight and re-arms if the receipt is rejected. The scroll body uses `--dsw-shadow-focus-ring`. InputBar's lightbox unit test fires Escape on `document`, matching the stack listener.

## Alternatives considered

**Map Escape to Allow.** Rejected: that would run the privileged command from a key that means cancel everywhere else.

**Two-step Escape (blur the body, then refuse).** Rejected: the panel has no typed draft to protect, unlike a question custom answer. Plan review already treats Escape as cancel in one key.

**Keep approval Escape off the stack.** Rejected: a settings overlay opened on top must still win the first key.

## Consequences

Keyboard users refuse an approval the same way they dismiss a dialog. Accidental Escape blocks the tool instead of running it. A later overlay still takes Escape first.

## Testing

`packages/client/ui-conversation/tests/approval-panel.client.spec.tsx` pins command extraction, refuse/allow, Escape-as-reject, later-overlay deferral, post-decision inert Escape, and re-arm after a lost receipt. `packages/client/ui-conversation/tests/approval-panel-styles.client.spec.ts` pins the body ring. `packages/client/ui-conversation/tests/input-bar.client.spec.tsx` fires lightbox Escape on `document`.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO. [Question and plan-review Escape](2026-09-05-question-plan-overlay-escape.md) owns the two-step question path. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
