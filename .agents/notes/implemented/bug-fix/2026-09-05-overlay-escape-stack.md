# Agent Note: Overlay Escape is a LIFO stack

Status: implemented

English | [中文](2026-09-05-overlay-escape-stack.zh.md)

## Problem

Menu, Modal, SettingsRoot, ContextMeter, and ImageLightbox each registered their own document or window Escape listener. Bubble order is mount order, so Settings (mounted first) closed on the same Escape that should have dismissed a Menu opened inside it. Nested Modals only survived because DirectoryBrowser gated the outer `onClose`. A parent re-render that replaced `onClose` would also restack if subscribe lifetime followed the callback identity, jumping Settings above a still-open Menu.

## Decision

`subscribeOverlayEscape` keeps a LIFO stack and one document listener. Only the top frame handles Escape (`preventDefault`; skip if already `defaultPrevented`). `useOverlayEscape(active, onClose)` subscribes for the overlay's open lifetime and stores `onClose` in a ref so a parent re-render does not reshuffle the stack. Menu, Modal, Settings, ContextMeter, and ImageLightbox consume the hook. Settings Escape restores focus to the trigger. Composer attach, AgentPresetSeat, tool-card copy/expand, Search file headers, JsonBlock toggle, and message-image frame/retry use `--dsw-shadow-focus-ring`.

## Alternatives considered

**`stopImmediatePropagation` on the top overlay.** Rejected: it would fight unrelated document listeners (menu arrows, path-edit). The stack plus `defaultPrevented` is enough once every overlay document Escape listener migrates.

**Keep DirectoryBrowser's outer gate as the only nested-modal fix.** Rejected: Settings+Menu and lightbox-over-dialog have no equivalent gate.

## Consequences

Escape dismisses one overlay at a time. A Menu in Settings no longer closes Settings. Nested create still closes first; the outer gate remains defense in depth. Keyboard chrome on attach, the preset seat, and tool cards matches the product ring.

## Testing

`packages/client/ui-primitives/tests/overlay-escape.client.spec.tsx` pins LIFO, double-unsub, `defaultPrevented`, hook active/`onClose` swap, and that a parent `onClose` identity change does not steal the stack. Modal, Menu, Settings, ContextMeter, and ImageLightbox tests still fire Escape on `document`. DirectoryBrowser nested-create Escape still pins topmost-first.

## Related

[Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token. [Feedback note Escape](2026-09-05-feedback-note-escape.md) previously owned ContextMeter `preventDefault` (now via the stack).
