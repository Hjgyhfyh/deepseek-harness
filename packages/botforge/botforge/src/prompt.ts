/**
 * Model-visible orchestrator section and per-employee specialist persona.
 * @module @deepseek-ai/dsh-botforge/prompt
 */
import type {
  BotForgeOrchestratorSection,
  BotForgeWorkerConfig,
  DelegatedSessionHeader,
} from './config.ts'
import {
  DEFAULT_ORCHESTRATOR_PROMPT,
  EMPLOYEE_TOOL_NAME,
  isDelegatedSession,
} from './config.ts'

/**
 * Specialist identity that frames every employee child's persona.
 * @param worker - roster row whose id and name the child must keep.
 * @returns the leading persona paragraph.
 */
export function employeeSpecialistIdentity(
  worker: Pick<BotForgeWorkerConfig, 'id' | 'name'>,
): string {
  return `Ты — сотрудник «${worker.name}» (id ${worker.id}), специалист. `
    + 'Ты не оркестратор. Выполни порученную задачу сам. Не порождай других агентов.'
}

/**
 * Build the child persona: specialist identity, stored employee prompt, then
 * skill bodies or a name-only fallback when bodies could not be loaded.
 * @param worker - employee whose stored prompt and skill names apply.
 * @param skillBodies - joined markdown from `ctx.skills`, or `''`.
 * @returns non-empty persona text.
 */
export function buildEmployeePersona(
  worker: BotForgeWorkerConfig,
  skillBodies: string,
): string {
  const namedSkills = worker.skills.filter((name) => name.trim() !== '')
  const skillFallback = skillBodies === '' && namedSkills.length > 0
    ? `Assigned skills: ${namedSkills.join(', ')}.`
    : ''
  return [
    employeeSpecialistIdentity(worker),
    worker.systemPrompt.trim(),
    skillBodies,
    skillFallback,
  ].filter((part) => part !== '').join('\n\n')
}

/**
 * Build the system-prompt section that lists enabled employees.
 * An empty string means the section is omitted from the assembled prompt.
 * Delegated children omit it even while the plugin is on, so they do not
 * receive orchestrator identity or `delegate_employee` instructions.
 * @param enabled - master plugin switch.
 * @param orch - orchestrator persona and MCP list.
 * @param workers - full roster; disabled rows are omitted.
 * @param header - assembling agent's session header, when assembly has one.
 * @returns prompt text, or `''` when the plugin is off or the agent is a child.
 */
export function buildOrchestratorSection(
  enabled: boolean,
  orch: BotForgeOrchestratorSection,
  workers: readonly BotForgeWorkerConfig[],
  header?: DelegatedSessionHeader,
): string {
  if (!enabled) return ''
  if (header !== undefined && isDelegatedSession(header)) return ''
  const active = workers.filter((w) => w.enabled)
  const lines = active.map((w) => [
    `- ${w.id}: ${w.name} — ${w.hint || w.roleDescription}`,
    w.skills.length ? `    skills: ${w.skills.join(', ')}` : '',
    w.systemPrompt.trim() ? `    system prompt: ${w.systemPrompt.trim()}` : '',
    w.mcp.length
      ? `    MCP: ${w.mcp.map((m) => `${m.name} (${m.url || m.command || '—'})`).join(', ')}`
      : '',
  ].filter(Boolean).join('\n')).join('\n')
  const orchMcp = orch.mcp.length
    ? `Orchestrator MCP: ${orch.mcp.map((m) => `${m.name} (${m.url || m.command || '—'})`).join(', ')}`
    : ''
  return [
    orch.systemPrompt.trim() || DEFAULT_ORCHESTRATOR_PROMPT,
    '',
    `Delegate with ${EMPLOYEE_TOOL_NAME}(employee_id, description, prompt). employee_id must be one of the ids below.`,
    orchMcp,
    '',
    'Employees (each has its own system prompt, skills, and MCP):',
    lines || '- (no enabled employees)',
    '',
    'Any employee message is visible to the others; anyone may reply to anyone. Finish the task without extra questions.',
  ].join('\n')
}
