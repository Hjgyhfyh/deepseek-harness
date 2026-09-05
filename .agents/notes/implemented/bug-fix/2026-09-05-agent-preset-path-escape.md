# Agent Note: Agent-preset revealed-path Escape and row-action focus color

Status: implemented

English | [中文](2026-09-05-agent-preset-path-escape.zh.md)

## Problem

Where the host has no desktop opener, the location action prints the directory on the row. Escape did nothing, so the next keystroke closed Settings while the path stayed on screen. Row actions used the product ring on `:focus-visible` but kept the idle tertiary color and transparent fill, so keyboard focus did not match hover. The delete action painted danger only on pointer hover.

## Decision

Escape on a row that is showing a path (`preventDefault`) hides it and restores focus to the location action. A row that is not showing a path ignores the key so Settings can still take it. Keyboard focus paints the actions in the same primary color and fill as hover, and the delete action in the same danger color. The ring stays on `:focus-visible`.

## Alternatives considered

**Put the revealed path on the overlay Escape stack.** Rejected: it is an in-flow line on the settings card, not a layer. A document subscriber would steal Escape from Settings whenever any path happened to be showing.

**Leave action color tertiary on focus and rely on the ring alone.** Rejected: hover already promotes the icon to primary (or danger). Keyboard focus that keeps the idle color looks like the pointer missed the control.

**Leave the path until the roster reloads.** Rejected: the user who asked to see the directory also needs a keyboard way to put it away without dismissing Settings.

## Consequences

Keyboard users hide a revealed directory with Escape and keep focus on the location action; a second Escape still dismisses Settings. Tab to a row action looks like hover, including delete.

## Testing

`packages/client/ui-agent-preset/tests/section.client.spec.tsx` pins hide-on-Escape with focus restore and idle-row ignore. `packages/client/ui-agent-preset/tests/section-store.client.spec.ts` pins hide and the no-op when the path is already gone. `packages/client/ui-agent-preset/tests/section-styles.client.spec.ts` pins the hover/focus color pairing.

## Related

[Overlay Escape stack](2026-09-05-overlay-escape-stack.md) owns LIFO overlays. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) already lists AgentPreset action rings.
