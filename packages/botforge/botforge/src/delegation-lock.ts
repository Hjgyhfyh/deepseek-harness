/**
 * Hide and refuse delegation tools on employee children.
 * `tools.restrict()` rejects unknown names, so the deny list is always the
 * intersection of {@link isDelegationTool} with the viewing agent's visible set.
 * @module @deepseek-ai/dsh-botforge/delegation-lock
 */
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-subagent'
import { EMPLOYEE_TOOL_NAME, parseEmployeeId } from './config.ts'

/** Names an employee child must not inherit, plus any `subagent_*` spawn tool. */
export const EMPLOYEE_DENIED_TOOLS: readonly string[] = [
  EMPLOYEE_TOOL_NAME,
  'subagent',
  'subagent_fork',
  'send_message',
  'interrupt_agent',
  'list_agents',
]

/**
 * Whether this model-facing tool starts, messages, or lists other agents.
 * `subagent_*` matches preset rows such as `subagent_fork` without listing each
 * optional provider tool.
 * @param name - the tool name the viewing agent currently sees.
 * @returns `true` when an employee child must not receive that tool.
 */
export function isDelegationTool(name: string): boolean {
  return EMPLOYEE_DENIED_TOOLS.includes(name) || name.startsWith('subagent_')
}

/** Registry view used to name only those denied tools one agent can actually see. */
export interface AgentToolSchemas {
  /**
   * Model-visible tool names for one viewing scope.
   * @param scope - the agent used as the tools-registry scope key.
   * @returns the schemas that viewing scope currently sees.
   */
  schemas(scope?: Agent): readonly { readonly name: string }[]
}

/** Tool registry operations the employee lock needs on a scoped child context. */
export interface EmployeeToolLock {
  /**
   * Model-visible tool names for one viewing scope.
   * @param scope - the employee child, used as the tools-registry scope key.
   * @returns the schemas that viewing scope currently sees.
   */
  schemas(scope?: Agent): readonly { readonly name: string }[]
  /**
   * Hide inherited tools from this scoped child.
   * @param filter - deny list of names this child currently sees.
   * @returns the disposer that lifts this restriction.
   */
  restrict(filter: { deny: string[] }): () => void
  /**
   * Deny execution even if a name remains visible.
   * @param guard - returns a reason to deny, or `undefined` to allow.
   * @returns the disposer that unregisters the guard.
   */
  guard(guard: (execution: { name: string }) => string | undefined): () => void
}

/**
 * Build the child `toolFilter` that hides inherited delegation tools.
 * Unknown names fail `tools.restrict()`, so only currently visible names are kept.
 * @param tools - schema lookup (`ctx.tools`).
 * @param agent - viewing agent, used as the registry scope key.
 * @returns `{ deny }` when at least one listed tool is visible, otherwise `undefined`.
 */
export function employeeToolFilter(
  tools: AgentToolSchemas,
  agent: Agent,
): { deny: string[] } | undefined {
  const deny = tools.schemas(agent).map((row) => row.name).filter(isDelegationTool)
  return deny.length > 0 ? { deny } : undefined
}

/**
 * Hide visible delegation tools on this child and deny them if a later
 * registration brings a name back.
 * @param tools - the child's scoped tools accessor (`childCtx.tools`).
 * @param agent - the employee child, used as the viewing scope.
 * @returns a disposer that lifts both the restriction and the guard.
 */
export function lockEmployeeDelegation(tools: EmployeeToolLock, agent: Agent): () => void {
  const filter = employeeToolFilter(tools, agent)
  const disposeRestrict = filter === undefined ? undefined : tools.restrict(filter)
  const disposeGuard = tools.guard((execution) =>
    isDelegationTool(execution.name)
      ? 'employees cannot spawn or steer other agents'
      : undefined)
  return () => {
    disposeGuard()
    disposeRestrict?.()
  }
}

/**
 * Read the durable creation label from a child's `subagent/descriptor` event.
 * @param agent - the child whose session seed or log may carry the descriptor.
 * @returns the label, or `undefined` when none has been recorded yet.
 */
export function creationLabelOf(agent: Agent): string | undefined {
  for (const event of agent.session.events) {
    if (event.type !== 'subagent/descriptor') continue
    const label = event.data.label
    if (typeof label === 'string' && label.length > 0) return label
  }
  return undefined
}

/**
 * Whether this live agent is a BotForge employee child.
 * @param agent - candidate child.
 * @returns `true` when its creation label is an `employee:` roster id.
 */
export function isEmployeeChild(agent: Agent): boolean {
  const label = creationLabelOf(agent)
  return label !== undefined && parseEmployeeId(label) !== undefined
}
