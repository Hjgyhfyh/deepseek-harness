# Agent Note: Models customized-fold nested Escape skip and danger-action focus fill

Status: implemented

English | [中文](2026-09-05-models-customized-nested-escape.zh.md)

## Problem

The 自定义设置 fold collapsed on any bubbling Escape while open. A nested control that already handled the key (`preventDefault`) still closed the fold, so a select, search, or overlay inside the extras could not keep its own dismiss. Row Remove and the delete-confirm action used the product ring on `:focus-visible` but kept a transparent fill, so keyboard focus did not match their danger hover.

## Decision

The fold handler skips `event.defaultPrevented`, then `preventDefault`s and collapses as before. Keyboard focus paints Remove and delete-confirm in the same danger fill as hover. The ring stays on `:focus-visible`. Capacities still `stopPropagation` so the fold can take the next key after they collapse.

## Alternatives considered

**Keep collapsing even after a nested preventDefault.** Rejected: that steals the key from a control that already used it. Idle fields still bubble, so Escape from those still closes the fold.

**Leave Remove and delete-confirm transparent on focus and rely on the ring alone.** Rejected: hover already seats the danger fill. Keyboard focus that keeps a transparent fill looks like the pointer missed the control.

**Put the fold on the overlay Escape stack.** Rejected: it is an in-flow disclosure on the settings card, not a layer. A document subscriber would steal Escape from Settings whenever the fold happened to be open.

## Consequences

A nested control can spend Escape on itself without collapsing 自定义设置. An unhandled Escape from a field still closes the fold and restores summary focus. Tab to Remove or delete-confirm looks like hover.

## Testing

`packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` pins nested-field collapse and that a `defaultPrevented` Escape leaves the fold open. `packages/client/ui-settings-models/tests/styles.client.spec.ts` pins the hover/focus danger-fill pairing.

## Related

[Plugin configuration nested Escape](2026-09-05-plugin-card-nested-escape.md) owns the same skip on plugin cards. [Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists model-field rings.
