# Agent Note: AgentPreset creator dash and retry focus ring

Status: implemented

English | [中文](2026-09-05-agent-preset-creator-ring.zh.md)

## Problem

The dashed Creator add-card on the preset section used hover fill only. Keyboard focus kept the idle grey dash and the user-agent outline or none, unlike the no-workspace composer card (business-blue dash on hover/focus) and every other settings control on the product ring. The roster-load retry control had hover fill and no ring.

## Decision

The creator card paints `--dsw-alias-state-business-primary` on the dash for hover and `:focus-visible`, and uses `--dsw-shadow-focus-ring` on keyboard focus. The retry control uses the same ring. Disabled creator chrome is unchanged (opacity, no dash, no ring). The unavailable-root reason stays a `title` only when the button is disabled.

## Alternatives considered

**Match Models `addButton` (ring, no dash recolor).** Rejected: the creator card is documented as a vacant slot a preset will appear in, the same reading as the no-workspace composer card. A grey dash on focus would not tell a keyboard user they are on the empty slot.

**Put Creator on the overlay Escape stack.** Rejected: it is not an overlay. Settings already owns Escape; Enter on the native button starts the draft.

## Consequences

Keyboard users see the same blue dash and product ring as pointer hover when they Tab to Creator, then Enter still leaves Settings into the new session. Retry after a roster failure is a visible tab stop. A disabled Creator (no writable root) does not fake an active slot.

## Testing

`packages/client/ui-agent-preset/tests/section-styles.client.spec.ts` pins the creator dash/ring and the retry ring. Existing section tests still click Creator and Retry.

## Related

[No-workspace composer card](2026-09-05-workspace-card-picker-toggle.md) owns the blue-dash empty-slot language. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) owns the ring token and now lists this chrome.
