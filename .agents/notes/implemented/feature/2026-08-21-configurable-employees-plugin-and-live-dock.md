# Agent Note: Configurable employees plugin with a live dock

Status: implemented

English | [中文](2026-08-21-configurable-employees-plugin-and-live-dock.zh.md)

## Problem

The BotForge surface mixed three jobs that users need separately: a master on/off switch, per-employee system prompts / skills / MCP, and a live view of the employee the main agent just delegated to. The shipped Web entry was a sidebar-footer `🤖 BotForge` button that opened a fake overlay chat, so configuration and delegation were not first-class product controls.

## Decision

**Host settings own the roster and the switch.** `dsh-botforge` registers `botforge-workers` and `botforge-orchestrator` as live settings namespaces. `enabled` (default true) drops the `botforge:workers` prompt section and unregisters `delegate_employee` together. Each employee row stores its own system prompt, skill names, and MCP servers.

**Delegation is a host tool, not a second fake chat.** `delegate_employee(employee_id, description, prompt, run_in_background?)` starts an in-process `spawn` child, labels it `employee:<id>: <description>`, applies the persona when the provider allows it, loads skill bodies from `ctx.skills` before start, and mounts that employee's MCP servers on the child after publication. Background is the default so the parent can keep working.

**The Web dock is a `shell.overlay` panel, not a footer action.** `dsh-client-ui-botforge` registers Settings → Employees and a right-side dock whose root is the panel itself (the overlay layer keeps `pointer-events: none` on empty space). The dock lists catalog children of the current session or its parent whose labels match an employee, and opens them with `sessions.openSubagent`. The settings page remains when the plugin is off.

## Alternatives considered

**Keep the footer BotForge button and restyle it.** Rejected because a second overlay chat duplicates Conversation, hides the real child transcript, and still leaves per-employee configuration without a settings home.

**Reuse `subagent` instead of a dedicated tool.** Rejected because a generic child has no roster id, no per-employee persona/skills/MCP, and no stable label the dock can match without extra protocol.

**Install orchestrator MCP on the host context.** Rejected because root-context tools would appear on every agent in the process. Those rows stay prompt-only.

**Use `registerContinuableSetup` for employee extras.** Rejected because that contribution runs for every continuable child and is synchronous, while employee MCP start is async and employee-specific.

## Consequences

Users turn employees on or off from Settings, edit each row independently, and see a delegated employee on the right as soon as the catalog carries an `employee:` (or fuzzy) label. The sidebar no longer shows the BotForge footer control. First-turn MCP on a continuable child can still race the first model request; skill bodies do not, because they are loaded before start.
