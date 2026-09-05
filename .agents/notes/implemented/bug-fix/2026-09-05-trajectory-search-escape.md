# Agent Note: Escape clears trajectory toolbar search

Status: implemented

English | [中文](2026-09-05-trajectory-search-escape.zh.md)

## Problem

The trajectory ledger search is a controlled `type="search"` field. Escape did nothing in the React state: Chrome's native search-clear can empty the DOM value without `onChange`, so the filter stayed on the previous query. An empty field also kept focus, so a second Escape could not leave the toolbar.

## Decision

Escape on a non-empty query `preventDefault`s and writes `''` through `onSearchQueryChange`. Escape on an empty query blurs the field. Toolbar toggles and the leftover plugin/queue/workflow/JsonTree/risk chrome use `--dsw-shadow-focus-ring`.

## Alternatives considered

**Rely on the user-agent search-clear.** Rejected: native Escape/`type="search"` does not reliably update a controlled React value.

**Stop the event so timeline range Escape cannot run.** Rejected: the search field is not an ancestor of the timeline; bubbling is not the bug.

## Consequences

One Escape drops the live ledger filter. A second Escape returns focus to the page. Keyboard focus on the toolbar matches the rest of the product ring.

## Testing

`packages/client/ui-trajectory/tests/layout.client.spec.tsx` pins clear-then-blur, typing, and the duration/fold controls.

## Related

[Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
