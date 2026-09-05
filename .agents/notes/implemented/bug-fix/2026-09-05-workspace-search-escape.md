# Agent Note: Workspace search Escape clears then collapses

Status: implemented

English | [中文](2026-09-05-workspace-search-escape.zh.md)

## Problem

Sidebar session search treated Escape as "clear and collapse" in one key. Click-outside already keeps a non-empty query expanded so the filter is not dropped by accident. Escape disagreed: a typed query vanished and the field closed. The session-header JobList trigger had no product focus ring.

## Decision

Escape on a non-empty sanitized query writes `''` and stays expanded. Escape on an empty query collapses. The JobList trigger uses `--dsw-shadow-focus-ring`.

## Alternatives considered

**Keep one-shot Escape as a faster dismiss.** Rejected: it fought the existing "query outlives collapse" contract and the trajectory/inventory search pattern.

**Make the clear button two-step as well.** Rejected: that control is labeled clear-and-close; Escape is the keyboard path.

## Consequences

The first Escape drops the live session filter without putting the header back. The second Escape restores the search icon. Keyboard focus on the jobs chip matches other header chrome.

## Testing

`packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` pins clear-then-collapse and that Enter does not dismiss.

## Related

[Escape clears trajectory toolbar search](2026-09-05-trajectory-search-escape.md) and [Escape clears plugin inventory search](2026-09-05-plugin-inventory-search-escape.md) own the same two-step pattern. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
