# Agent Note: HoverCard Escape and workspace search focus restore

Status: implemented

English | [中文](2026-09-05-hovercard-escape-and-search-focus.zh.md)

## Problem

Sidebar session search already treated a second Escape as collapse, but the input kept focus while flipping to `tabIndex={-1}`, so keyboard users were stuck on a field that is not in the tab order. The clear control unmounted itself and dropped focus on `document.body`. Click-outside already blurs then collapses an empty query and must not steal the caret back. HoverCard previews (session/project truncated titles) ignored Escape: a copyable card's `onKeyDown` only handles Enter/Space, so Escape neither copied nor dismissed.

## Decision

Wide-mode search keeps a trigger ref. Escape on an empty query and the clear button set a restore flag; an effect focuses the search chip after collapse so `:focus-visible` shows `--dsw-shadow-focus-ring`. Click-outside still collapses without restoring. HoverCard calls `useOverlayEscape(open, close)` so Escape dismisses the preview as the current overlay (z-popover sits above modal). Session and search-result rows keep the same ring token (now pinned in the workspace style test).

## Alternatives considered

**Restore the search chip after click-outside too.** Rejected: a click elsewhere would yank keyboard focus back to the sidebar.

**Handle HoverCard Escape only on the copyable card node.** Rejected: non-copyable previews have no tab stop, and a later dialog must win the shared stack.

## Consequences

The second Escape (and clear) returns the caret to the search icon with the product ring. An outside click still leaves focus where the pointer went. Hovering a truncated row and pressing Escape closes the preview without copying; a later overlay still takes the first Escape.

## Testing

`packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` pins Escape/clear restore and that outside click does not restore. `packages/client/ui-primitives/tests/hover-card.client.spec.tsx` pins Escape dismiss without copy and later-overlay deferral.

## Related

[Workspace search Escape](2026-09-05-workspace-search-escape.md) owns the two-step clear-then-collapse. [Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
