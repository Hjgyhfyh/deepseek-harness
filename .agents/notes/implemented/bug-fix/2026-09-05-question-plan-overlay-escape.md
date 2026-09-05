# Agent Note: Question and plan-review Escape join the overlay stack

Status: implemented

English | [中文](2026-09-05-question-plan-overlay-escape.zh.md)

## Problem

The composer question takeover had a cancel control and a collapse toggle, but Escape did nothing. A first key would have discarded the whole host wait. Plan review's "Chat about it" is the same cancel verb and was pointer-only. Header/pager icon buttons and the plan scroll body (a tab stop so a long plan can be read) used the user-agent outline or none.

## Decision

Question Escape is two-step on the overlay stack: first key collapses the card and restores focus to the maximize control; a second Escape (or Escape while already collapsed) cancels the wait. Plan review Escape is that cancel. The stack unsubscribes while a send is in flight. Header/pager buttons and the plan body use `--dsw-shadow-focus-ring`. The plan body is a labelled `tabIndex={0}` group so keyboard users can scroll it.

## Alternatives considered

**Map the first Escape to cancel.** Rejected: that is the same as clicking dismiss, and a typed custom answer would vanish with the wait.

**Keep plan-review Escape off the stack.** Rejected: discuss is already the cancel verb; a later dialog must still win the first key.

## Consequences

Keyboard users can hide a question to read the transcript, then dismiss it. Plan review Escape returns the composer the same way as "Chat about it". A settings overlay opened on top still takes Escape first.

## Testing

`packages/client/ui-user-questions/tests/user-questions-composer.client.spec.tsx` pins collapse-then-cancel and later-overlay deferral. `packages/client/ui-user-questions/tests/plan-review-panel.client.spec.tsx` pins Escape-cancel, later-overlay deferral, and that Escape is inert after a decision. `packages/client/ui-user-questions/tests/browser-styles.client.spec.ts` pins the rings.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
