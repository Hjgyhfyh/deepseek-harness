# Agent Note: Models customized-fold Escape collapse and focus color

Status: implemented

English | [中文](2026-09-05-models-customized-escape.zh.md)

## Problem

The Models editor's 自定义设置 area is a native `<details>` disclosure. Click/Enter opened base URL, catalog, and identity fields, but Escape did nothing — keyboard users who opened the fold or tabbed into a nested field had no collapse gesture short of clicking the summary again, and the next Escape would close Settings. The summary used the product ring on `:focus-visible` but kept the idle secondary color, so keyboard focus did not match hover.

## Decision

Escape on an open fold (`preventDefault`) collapses it and restores focus to the summary, including when a nested field holds focus. A closed fold ignores the key so the Settings overlay can still take it. Drafts stay in React state, as they already did for click-collapse. Keyboard focus paints the summary (and its chevron, via `currentcolor`) in the same primary label color as hover.

## Alternatives considered

**Put the fold on the overlay Escape stack.** Rejected: it is an in-flow disclosure inside Settings, not a layer. A document subscriber would steal Escape from Settings while the fold happened to be expanded.

**Leave the summary secondary on focus and rely on the ring alone.** Rejected: hover already promotes the label to primary. Keyboard focus that keeps the idle color looks like the pointer missed the control.

## Consequences

Keyboard users close 自定义设置 with Escape from the summary or a nested field and keep focus on the summary; a second Escape still dismisses Settings. Tab to the summary looks like hover. Model-row advanced folds are unchanged.

## Testing

`packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` pins closed-fold ignore, open-fold collapse from a nested field, and summary focus restore. `packages/client/ui-settings-models/tests/styles.client.spec.ts` pins the hover/focus color pairing.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Retry Escape](2026-09-05-retry-escape-and-continue-ring.md) is the transcript `<details>` sibling. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists the summary ring.
