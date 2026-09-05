# Agent Note: Escape clears plugin inventory search

Status: implemented

English | [中文](2026-09-05-plugin-inventory-search-escape.zh.md)

## Problem

The Settings plugin-inventory catalog is a controlled `type="search"` field. Escape did nothing in React state, so Chrome's native search-clear could empty the DOM without dropping the filter. An empty field kept focus. The load-failure Retry button had no product focus ring.

## Decision

Escape on a non-empty query `preventDefault`s and writes `''`. Escape on an empty query blurs the field. `.failure button:focus-visible` uses `--dsw-shadow-focus-ring`.

## Alternatives considered

**Rely on the user-agent search-clear.** Rejected: native Escape/`type="search"` does not reliably update a controlled React value. The trajectory toolbar already made that call.

**Close Settings on Escape from an empty field.** Rejected: the inventory tab is not the overlay owner; SettingsRoot already closes the dialog from document Escape.

## Consequences

One Escape restores the full catalog. A second Escape leaves the field. Keyboard Retry on a failed load matches the rest of settings chrome.

## Testing

`packages/client/ui-settings-plugin-inventory/tests/components.client.spec.tsx` pins clear-then-blur and that Enter does not clear.

## Related

[Escape clears trajectory toolbar search](2026-09-05-trajectory-search-escape.md) owns the same pattern on the ledger search. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token.
