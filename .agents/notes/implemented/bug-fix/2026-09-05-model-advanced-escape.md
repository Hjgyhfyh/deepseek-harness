# Agent Note: Model-row capacities Escape collapse and chevron focus color

Status: implemented

English | [中文](2026-09-05-model-advanced-escape.zh.md)

## Problem

Each Models catalog row folds its output cap (Capacities) behind a chevron. Click/Enter opened the field, but Escape did nothing — keyboard users who opened the fold or tabbed into max-tokens had no collapse gesture short of clicking the chevron again. The next Escape would then close 自定义设置 (or Settings). The chevron used the product ring on `:focus-visible` but kept the idle tertiary color, so keyboard focus did not match hover.

## Decision

Escape on an open capacities fold (`preventDefault`, `stopPropagation`) collapses it and restores focus to the chevron, including when the output-cap field holds focus. A closed fold ignores the key so the customized `<details>` and Settings can still take it. `stopPropagation` is required because the row lives inside 自定义设置; bubbling `preventDefault` alone would still run the parent details handler and collapse both on one key. Drafts stay in React state, as they already did for click-collapse. Keyboard focus paints the chevron in the same primary label color and hover fill as pointer hover; the delete glyph keeps the danger tint.

## Alternatives considered

**Put each row on the overlay Escape stack.** Rejected: these are in-flow disclosures inside Settings, not layers. A document subscriber would steal Escape from Settings (and from 自定义设置) while any row happened to be expanded.

**Leave the chevron tertiary on focus and rely on the ring alone.** Rejected: hover already promotes the glyph to primary. Keyboard focus that keeps the idle color looks like the pointer missed the control.

**Collapse without `stopPropagation`.** Rejected: the customized fold's handler is an ancestor `onKeyDown`. One Escape would close Capacities and 自定义设置 together.

## Consequences

Keyboard users close Capacities with Escape from the chevron or the output-cap field and keep focus on the chevron; a second Escape still collapses 自定义设置, and a third still dismisses Settings. Tab to the chevron looks like hover.

## Testing

`packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` pins closed-fold ignore (bubbles to 自定义设置), open-fold collapse from the output-cap field without closing the parent details, and chevron focus restore. `packages/client/ui-settings-models/tests/components.client.spec.tsx` pins the DeepSeek catalog editor the same way. `packages/client/ui-settings-models/tests/styles.client.spec.ts` pins the hover/focus color pairing.

## Related

[Models customized Escape](2026-09-05-models-customized-escape.md) is the parent fold. [Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists model icon-button rings.
