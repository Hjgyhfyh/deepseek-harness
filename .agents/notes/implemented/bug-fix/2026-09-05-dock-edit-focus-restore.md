# Agent Note: Dock edit cancel restores focus

Status: implemented

English | [中文](2026-09-05-dock-edit-focus-restore.zh.md)

## Problem

Canceling an inline GoalBar or queue-row edit unmounted the field and dropped keyboard focus on `document.body`. The plan strip header had no `aria-controls` for its list. Several composer-adjacent controls still used the user-agent focus outline.

## Decision

Escape, cancel, and a successful save put focus back on the edit control. TodoPanel keeps a (possibly `hidden`) list and points `aria-controls` at it. ContextMeter, TodoPanel, message copy/branch, compaction, details close, EnterBehavior, and the SubagentCatalog trigger use `--dsw-shadow-focus-ring`.

## Alternatives considered

**Leave focus on body after cancel.** Rejected: JobList Escape already returns to its trigger; the dock editors should match.

**Unmount the todo list while collapsed.** Rejected: `aria-controls` needs a stable target. QueueDock already keeps a hidden list.

## Consequences

Tab order survives cancel. Screen readers can associate the plan header with its rows. Keyboard chrome around the composer matches the rest of the product ring.

## Testing

`packages/client/ui-goal/tests/goalbar.client.spec.tsx` and `packages/client/ui-conversation/tests/queue-dock.client.spec.tsx` pin focus restore. `packages/client/ui-conversation/tests/todo-panel.client.spec.tsx` pins `aria-controls`.

## Related

[Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
