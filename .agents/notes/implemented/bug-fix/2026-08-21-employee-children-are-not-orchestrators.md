# Agent Note: Employee children are not orchestrators

Status: implemented

English | [中文](2026-08-21-employee-children-are-not-orchestrators.zh.md)

## Problem

`delegate_employee` starts an in-process `spawn` child that joins its parent's preset and inherits host-global registrations. The BotForge orchestrator section `botforge:workers` (order 12) and the `delegate_employee` tool were both host-global, and the child also inherited preset `subagent` / `subagent_fork` / `send_message` / `interrupt_agent` / `list_agents`. The child's own `deployment:persona` only shadowed order 0, so every employee still read "you are the orchestrator, call `delegate_employee`" and still saw those tools. Nested children then appeared in the live dock as further employees.

## Decision

The orchestrator section is empty when the assembling agent is a delegated session (`origin: 'subagent'` or `delegationDepth > 0`). Only the root session keeps the roster and the `delegate_employee` instruction.

Every employee start builds a non-empty specialist persona that names the roster id, states that the child is not the orchestrator, and forbids spawning. When the spawn provider advertises `persona`, that text is the child's `deployment:persona`; otherwise it is prepended to the user prompt.

Spawn tools are hidden and refused on the employee child, not only on the parent start request. `isDelegationTool` matches `delegate_employee`, `subagent`, any `subagent_*` name, `send_message`, `interrupt_agent`, and `list_agents`. The start request's `toolFilter.deny` lists the subset the parent currently sees; unknown names are omitted because `tools.restrict()` fails loud on them. After `applyChildComposition` joins the parent preset, `registerContinuableSetup` calls `lockEmployeeDelegation` on `childCtx.tools` (the scoped accessor, not `ctx.get('tools')`) so preset rows such as `subagent_fork` are in the deny list before the first model turn. `installEmployeeExtras` applies the same lock on a published or one-shot child. A process-wide `tools.guard` denies those names when the caller is an employee child (`employee:` creation label). `delegate_employee` itself rejects a caller whose session is already delegated.

The stored employee system prompt is not rewritten. A row that still contains orchestrator copy is framed by the specialist paragraph; editing the row in Settings is what removes that copy.

## Verification

`packages/botforge/botforge/tests/prompt.spec.ts` covers an empty section for delegated headers and the specialist persona prefix, including a blank stored prompt and the skill-name fallback. `tool.spec.ts` covers nested-caller rejection, `toolFilter.deny` for parent-visible names including `subagent_fork`, a blank-prompt persona that still carries the specialist paragraph, and prompt prepend when the provider has no persona capability. `delegation-lock.spec.ts` covers `isDelegationTool`, the child restrict-and-guard lock, and `employee:` identity from `subagent/descriptor`. `extras.spec.ts` covers the extras-path lock. `index.spec.ts` assembles with a child `AssembleContext.agent` and asserts the orchestrator wrapper is absent, denies `subagent_fork` for an employee caller, and applies continuable setup only to `employee:` children. `config.spec.ts` covers `isDelegatedSession`.

## Alternatives considered

**Register `delegate_employee` only on the root agent's own scope.** Rejected because BotForge mounts at host load, before any session exists, and there is no host hook that runs once per root agent without duplicating preset composition.

**Pass `maxDepth: 0` on the employee start.** Rejected because that cap applies to the child being started: a depth-1 employee would fail to start rather than be forbidden from starting grandchildren.

**Deny only the parent-visible names on the start `toolFilter`.** Rejected as the sole lock: `tools.restrict()` rejects unknown names, and preset spawn tools such as `subagent_fork` are not on the host-global view. The child must lock after `composeFrom`.

**Replace the stored employee prompt with a complete `systemPrompt.section({ complete: true })`.** Rejected because a complete section would drop harness identity, tool guidance, and the child's assigned skills, not only the orchestrator wrapper.

**Rewrite stored employee prompts that mention the orchestrator.** Rejected because user-owned settings are the source of that copy; the runtime frames it and documents the Settings edit.

## Consequences

An employee child sees its own specialist persona, its stored prompt, and its skills/MCP, not the orchestrator roster or delegation tools. A generic `subagent` child of the same parent also omits the orchestrator section, but keeps spawn tools. `delegate_employee` remains globally registered; an employee child cannot execute it. First-turn MCP on a continuable employee can still race the first model request; the persona, start `toolFilter`, and continuable-setup lock do not, because they run in the unpublished creation window. An already-resident Activation keeps the tool set it was created with until rematerialized.
