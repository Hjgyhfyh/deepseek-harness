# @deepseek-ai/dsh-client-ui-botforge

English | [中文](README.zh.md)

Employees surface plugin, browser half. Settings → Employees (slot `settings.section`, id `employees`, order 22) edits the host `botforge-workers` and `botforge-orchestrator` documents: the master plugin switch, orchestrator persona and MCP list, and each employee's system prompt, skills, and MCP servers. A right-side `shell.overlay` dock lists children of the current session (or its parent) whose labels match an employee, and opens them through `sessions.openSubagent`. The overlay root is the dock panel itself so the rest of the shell keeps `pointer-events: none`.

Turning the plugin off hides the dock; the settings page stays so the user can turn it back on. The former sidebar-footer BotForge button and fake overlay chat are not registered.

The `/client` exports are the plugin body (`apply`/`inject`) and the injected settings and dock faces.

## Model Experience

Indirectly, through the host `botforge-workers` and `botforge-orchestrator` settings this page writes, whose model-visible prompt section and `delegate_employee` tool [`dsh-botforge`](../../botforge/botforge/README.md) owns.

#### KV Cache effect

None in this package. Host settings commits may invalidate the parent request prefix when `dsh-botforge` rebuilds its prompt section or remounts the tool.

## Known Limitations and Deferred Work

- **The dock is match-only** — it does not start employees; the host tool creates the child, and this overlay only surfaces matching catalog rows.
