# Agent Note: Header popovers join the overlay Escape stack

Status: implemented

English | [中文](2026-09-05-header-overlay-escape.zh.md)

## Problem

Tick 9 moved Menu/Modal/Settings/ContextMeter/ImageLightbox onto a LIFO Escape stack. ModelSelect, JobList, and SubagentCatalog still handled Escape on their own root. ModelSelect lives inside Settings: a bubbled Escape closed the pane and then the settings overlay. JobList and the catalog only heard Escape while focus stayed inside their subtree, so a later dialog could not take the first Escape, and after that dialog closed the popover stayed up.

## Decision

Those three popovers subscribe through `useOverlayEscape` for their open lifetime. ModelSelect still backs out of a drilled pane before closing. JobList and the catalog still restore focus to the trigger. Web search/fetch source links use `--dsw-shadow-focus-ring`.

## Alternatives considered

**`stopPropagation` on ModelSelect Escape.** Rejected: it would hide the event from the stack instead of participating in it, and JobList/catalog would still miss document-level Escape.

**Leave header popovers on their subtree listeners.** Rejected: Settings + ModelSelect still double-dismiss, and a popover open under a dialog never sees the second Escape.

## Consequences

Escape inside a model menu in Settings closes only the menu. A later overlay closes first while JobList or the catalog stays open; the next Escape dismisses the popover even if focus is already back on another trigger.

## Testing

`packages/client/ui-model-selection/tests/model-select.client.spec.tsx` pins pane back-out then close. `packages/client/ui-jobs/tests/job-list-action.client.spec.tsx` pins that a later stack frame wins, then the list closes. Subagent catalog keyboard tests still fire Escape on the focused row.

## Related

[Overlay Escape is a LIFO stack](2026-09-05-overlay-escape-stack.md) owns the shared listener. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
