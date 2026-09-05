# Agent Note: Overlay z-index ladder, radius, and motion scale

Status: implemented

English | [中文](2026-09-05-overlay-z-index-and-motion-scale.zh.md)

## Problem

Overlay chrome (modal, settings, lightbox, toast, tooltip, menus) each picked a local integer. Tooltip and hover cards sat at `100` while dialogs sat at `1000`, so a bubble that later portals to `document.body` would paint under the mask. Toast sat at `1100` to beat the lightbox at `1000`; menu portals sat at `1100` to beat dialogs — two independent "just above 1000" bids with no shared ladder. Keyboard focus was `outline: none` on several chrome controls. Dark-theme elevation used the light-mode shadow alphas, which collapse to a hairline halo.

## Decision

`packages/client/ui-theme/src/styles/base.css` owns four additive scales:

- `--dsw-z-sticky` 100, `--dsw-z-dropdown` 1000, `--dsw-z-overlay` 1100, `--dsw-z-modal` 1200, `--dsw-z-popover` 1300, `--dsw-z-tooltip` 1400, `--dsw-z-toast` 1500
- `--dsw-radius-xs` through `--dsw-radius-3xl` plus `--dsw-radius-pill`
- `--dsw-motion-fast|normal|slow` and `--dsw-easing-*`; `@media (prefers-reduced-motion: reduce)` zeros the motion scale
- `--dsw-shadow-focus-ring`, with a stronger dark-theme alpha on `body[data-ds-dark-theme]`

Viewport overlays consume the z-index ladder. In-flow stacking (timeline, composer seats, drag handles) keeps local integers. Portaled menus use `--dsw-z-popover` so they remain above `--dsw-z-modal`. Keyboard chrome (`Button`, `Input` focus-within, modal/settings/lightbox close, sidebar New Session, settings trigger/nav, composer attach/send/Continue/Plan select, model chip, ModelSelect cells/retry, permission chips, GoalBar icons, ContextMeter trigger, TodoPanel header, message copy/branch, message feedback, compaction marker, details close, conversation crumbs/tabs, older/toBottom, AttachmentRail thumbnails/remove/arrows, message-image frame/retry, CodeBlock copy, Terminal/Search/Read/Diff copy and expand, Search file headers, JsonBlock toggle, EnterBehavior selector, Language/Appearance/Permission/AgentPreset selectors, AgentPresetSeat, AgentPreset creator/retry, SubagentCatalog trigger, JobList trigger, QueueDock header and actions, workspace search/rows/rename/overflow, create-workspace and directory-create fields, directory crumb bar on keyboard path edit, directory crumbs/rows/show-hidden, BotForge roster/dock, question-composer options, plugin/preset/model fields, plugin cards/tabs/inventory cards and retry, trajectory toolbar/load-earlier/track/collapsed rows/source jump/details splitter/close/detail tabs/overview toggles/tool-call rows, skill/bash rows and Inspect, produced-file chips, JsonTree expander and copy, markdown links and file mentions, web search/fetch source links, slash-menu items, workflow run/phase/member, command-palette active row, Menu items, DisclosureRow, retry summary, turn-error Continue, Plan chip, risk-confirmation checkbox, question-composer header/pager, approval-panel scroll body, plan-review scroll body) uses the focus ring. AppFrame's conversation column is a `<main>` landmark.

## Alternatives considered

### Keep the previous 100 / 1000 / 1100 bids and only raise tooltip to 1100

Rejected: every new overlay would re-pick a number, and toast vs lightbox vs menu portal would keep colliding.

### One global `:focus-visible` rule in the shell sheet

Rejected: many controls already set `outline: none` at higher specificity, and some figma nodes (composer modal input) intentionally omit a ring. Chrome that is a tab stop opts in.

### Replace every figma radius (18, 22, 14) with the nearest scale step

Rejected: those radii are the shipped DeepSeek Chat geometry. The scale is used where the value already matches.

## Consequences

A tooltip or hover card stays readable over a dialog. A portaled menu stays above settings. Toast remains the top announcement layer. Reduced-motion users get a zero-duration motion scale without each animation rewriting its own `@media`. Keyboard users get a visible ring on primary chrome. Figma-specific 18/22 radii stay as authored numbers.

## Testing

`packages/client/ui-layout/tests/app-frame.client.spec.tsx` pins the conversation column as `main`. Primitive and settings tests continue to exercise the same chrome; they do not snapshot computed z-index.

## Related

[Themed scrollbars and reserved gutter](../bug-fix/2026-07-28-themed-scrollbars-and-reserved-gutter.md) owns scrollbar rebinding. Theme tokens live in [`dsh-client-ui-theme`](../../../../packages/client/ui-theme/README.md).
