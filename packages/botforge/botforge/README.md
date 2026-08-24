# @deepseek-ai/dsh-botforge

English | [中文](README.zh.md)

Employee roster, orchestrator prompt, and the `delegate_employee` tool. Configuration lives in the host settings document: `botforge-workers` holds the roster, and `botforge-orchestrator` holds the master switch plus the orchestrator persona. The Web settings page and live dock are [`dsh-client-ui-botforge`](../../client/ui-botforge/README.md).

The master `enabled` switch (default `true`) drops the orchestrator system-prompt section and unregisters `delegate_employee` together. The settings page stays mounted so the user can turn the plugin back on. Disabled employees remain stored but are omitted from the prompt and rejected by the tool.

Each employee row carries its own system prompt, skill names, and MCP servers. `delegate_employee` starts a continuable child through the in-process `spawn` provider by default, labels it `employee:<id>: <description>` for the live dock, applies the persona when the provider advertises that capability, loads skill bodies from `ctx.skills` before start, and mounts that employee's MCP servers on the child's context after the child is published.

## Settings

| Namespace | Fields |
|---|---|
| `botforge-workers` | `workers[]` with `id`, `enabled`, `name`, `role`, `roleDescription`, `skills`, `hint`, `triggers`, `systemPrompt`, `avatar`, `avatarSeed`, `mcp[]` |
| `botforge-orchestrator` | `enabled`, `name`, `systemPrompt`, `mcp[]` |

Duplicate or empty employee ids fail the workers-section validator. An empty stored roster falls back to the built-in employees. Orchestrator MCP rows are listed in the parent prompt and are not auto-mounted on the parent agent.

## Events

`botforge/config` fires after a live settings commit. `botforge/routed` fires after a successful background `delegate_employee` start, with the child id, prompt text, chosen employee id, and the enriched prompt text.

## Model Experience

### Orchestrator prompt section

#### What the model sees

While `enabled` is true, a `botforge:workers` system-prompt section (order 12) contains the stored orchestrator persona, then this stable wrapper, then one bullet per enabled employee (id, name, hint, skills, system prompt, MCP). An empty enabled roster renders `- (no enabled employees)`. Turning the plugin off, or assembling for a delegated child (`origin: 'subagent'` or `delegationDepth > 0`), returns an empty string, so the section is omitted from that agent's prompt.

##### Delegation wrapper

```markdown
Delegate with delegate_employee(employee_id, description, prompt). employee_id must be one of the ids below.
```

##### Employee list heading

```markdown
Employees (each has its own system prompt, skills, and MCP):
```

#### Token effect

Conditional on the master switch and on whether the assembling agent is a root session. Size follows the stored orchestrator prompt plus every enabled employee's hint, skills, system prompt, and MCP list, and is retained until compaction while the plugin stays on for that root agent.

#### KV Cache effect

Prefix-stable while `enabled`, the orchestrator persona, and the enabled roster text are unchanged. Toggling the plugin or editing those stored fields invalidates reuse from this section.

### Employee child identity

#### What the model sees

An employee child does not receive the orchestrator section. Its `deployment:persona` starts with `Ты — сотрудник «<name>» (id <id>), специалист. Ты не оркестратор. Выполни порученную задачу сам. Не порождай других агентов.`, then the stored employee system prompt and loaded skill bodies. The start request also passes `toolFilter.deny` naming every parent-visible spawn tool (`delegate_employee`, `subagent`, `subagent_*`, `send_message`, `interrupt_agent`, `list_agents`). After the child joins the parent preset, the same deny list is applied on `childCtx.tools`, and a process-wide guard denies those names when the caller is an employee child. A nested `delegate_employee` call from a delegated session is rejected as `Error: delegate_employee is only available to the orchestrator`.

#### Token effect

The specialist paragraph is a fixed prefix on every employee child request. Denied tool schemas leave the child request; they remain on the parent.

#### KV Cache effect

Prefix-stable for one child while that employee's stored prompt, loaded skill bodies, and denied-tool set stay unchanged. A different employee id or name changes the leading paragraph.

### Delegation tool

#### What the model sees

While the plugin is on, the root agent receives `delegate_employee` with required `employee_id`, `description`, and `prompt`, plus optional `run_in_background` (default true). The description tells the model to use this tool instead of `subagent` when the work belongs to a named employee. This package is not a `tool-*` leaf, so the generated [tool catalog](../../../docs/tool-catalog.md) does not harvest it.

#### Token effect

Fixed schema cost on every parent request while the tool is registered. Disabling the plugin removes both this schema and the prompt section.

#### KV Cache effect

Prefix-stable while the tool remains registered with the same description and parameters. Enable/disable remounts the tool and may invalidate reuse from the first changed tool definition.

### Continuable result

#### What the model sees

An omitted or true `run_in_background` starts a continuable child and returns exactly `started employee <childId>`. Every call opens a NEW conversation with that employee — one task per chat: for a new task, call this tool again instead of sending everything into one chat, and use the existing `send_message` tool (when loaded) only to add work to that same task's chat; its `deliver: "now"` mode interrupts the employee's current turn and delivers immediately.

#### Token effect

The acknowledgement is retained in parent history. Child working context remains in the child.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Foreground result

#### What the model sees

`run_in_background: false` waits for the child and returns its final text. Non-`completed` stop reasons become `Error: employee run ended (<reason>)`. Unknown, disabled, or missing employees, a missing spawn provider, a missing calling agent, and a delegated caller become errored tool results.

#### Token effect

The prompt and result remain in parent history until compaction; child working context remains in the child.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

## Known Limitations and Deferred Work

- **Orchestrator MCP is prompt-only** — those rows are listed for the parent model and are not mounted as parent tools, so they cannot leak into every agent on the host context.
- **Employee MCP mounts after continuable publication** — skill bodies are loaded before start; MCP servers start on the published child and may miss the first model request if that turn begins immediately.
- **The live dock matches `employee:` labels first** — a plain `subagent` child still appears when an enabled employee's id or name occurs in its label.
- **Already-resident employee Activations keep the tool set they were created with until rematerialized** — a process restart or a new `delegate_employee` rebuilds the child and applies the spawn lock.
- **A stored employee prompt that still calls the child an orchestrator is framed, not rewritten** — the specialist identity is prepended; edit the row in Settings to remove leftover orchestrator copy.
