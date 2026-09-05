# Agent Note: Feedback note Escape restores focus

Status: implemented

English | [中文](2026-09-05-feedback-note-escape.zh.md)

## Problem

The per-message feedback note editor had no Escape path. Cancel unmounted the field and dropped keyboard focus on `document.body`. ContextMeter Escape closed the panel without `preventDefault`, so a parent overlay could also dismiss. Settings selector pills, conversation crumbs/tabs, the back-to-bottom control, attachment rail chrome, and the markdown copy button still used the user-agent outline.

## Decision

Escape (and cancel/save) close the note editor and restore focus to the opener. The textarea autofocuses on open. ContextMeter Escape `preventDefault`s. The leftover chrome uses `--dsw-shadow-focus-ring`.

## Alternatives considered

**Leave Escape to the browser.** Rejected: a textarea does not close itself, and GoalBar/QueueDock already return focus after cancel.

**Keep ContextMeter Escape bubbling.** Rejected: SettingsRoot also listens on `document`; both would close.

## Consequences

Keyboard users can abandon a feedback note without losing the row. Opening the context meter and pressing Escape no longer races the settings overlay. Settings and transcript chrome match the product ring.

## Testing

`packages/client/ui-message-feedback/tests/message-feedback-actions.client.spec.tsx` pins Escape/cancel/save focus restore and that Enter stays in the editor. `packages/client/ui-conversation/tests/context-meter.client.spec.tsx` still pins Escape close.

## Related

[Dock edit cancel restores focus](2026-09-05-dock-edit-focus-restore.md) owns the same restore pattern on the composer dock. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
