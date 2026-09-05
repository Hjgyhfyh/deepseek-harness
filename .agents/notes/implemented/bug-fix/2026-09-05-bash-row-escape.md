# Agent Note: Bash row Escape collapse and leftover keyboard chrome

Status: implemented

English | [中文](2026-09-05-bash-row-escape.zh.md)

## Problem

The dedicated bash/pwsh tool row is a whole-row disclosure with click/Enter/Space, but Escape did nothing — keyboard users who opened the terminal card had no collapse gesture short of clicking the summary again. The expandable header used the user-agent outline or none, and the icon→chevron preview was hover-only, so keyboard focus did not match pointer. Inspect stayed `opacity: 0` until hover, so Tab landed on an invisible control.

## Decision

Escape on the card (`preventDefault`) collapses an open row and restores focus to the header, including when Inspect holds focus. A closed row ignores the key so a later overlay can still take it. The header uses `--dsw-shadow-focus-ring` and shows the hover chevron on `:focus-visible`. Inspect stays visible while the card contains focus and uses the product ring.

## Alternatives considered

**Put the row on the overlay Escape stack.** Rejected: it is an in-flow disclosure, not a layer. A document subscriber would steal Escape from a dialog opened while a bash row happened to be expanded.

**Leave Inspect hidden until it is focused.** Rejected: Tab would move into an invisible control. Showing it on `:focus-within` matches hover without painting it on every collapsed row.

**Switch the row onto `DisclosureRow`.** Rejected: the bash registrant is a local replica of ToolRow's chrome (terminal card, running sweep) and must not import the chat-domain row. Escape and the leftover chrome belong on this replica.

## Consequences

Keyboard users close a bash terminal card with Escape and keep focus on the summary. Inspect is visible whenever the card is the keyboard context. A settings overlay still wins the first Escape because the row only handles the key while it (or Inspect) is focused.

## Testing

`packages/client/ui-tool/tests/terminal-card.client.spec.tsx` pins closed-row ignore, open-row collapse, and Inspect Escape restoring header focus. `packages/client/ui-tool/tests/bash-row-styles.client.spec.ts` pins both rings and the focus chevron preview.

## Related

[Skill row Escape](2026-09-05-skill-row-escape.md) is the sibling replica. [DisclosureRow Escape](2026-09-05-disclosure-row-escape.md) is what generic ToolRow already uses. [Overlay z-index ladder](../architecture/2026-09-05-overlay-z-index-and-motion-scale.md) now lists the bash-row ring beside skill.
