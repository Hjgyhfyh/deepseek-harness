/**
 * Durable employee (worker) and orchestrator settings for BotForge.
 * @module @deepseek-ai/dsh-botforge/config
 */
import z from '@deepseek-ai/schemastery'
import { WORKERS } from './workers/definitions.ts'

/** Settings namespace for the employee roster. */
export const WORKERS_NS = 'botforge-workers'
/** Settings namespace for the orchestrator, including the plugin master switch. */
export const ORCH_NS = 'botforge-orchestrator'
/** Model-facing tool that starts one configured employee as a continuable child. */
export const EMPLOYEE_TOOL_NAME = 'delegate_employee'
/** Creation-label prefix persisted on a delegated child session. */
export const EMPLOYEE_LABEL_PREFIX = 'employee:'
/** Default in-process subagent provider used for employee children. */
export const EMPLOYEE_PROVIDER = 'spawn'
/** Session-header fields that mark a delegated child rather than the orchestrator. */
export interface DelegatedSessionHeader {
  /** Product origin stamped on every in-process subagent child. */
  readonly origin?: string
  /** Absent or `0` for a top-level session; parent depth + 1 for a child. */
  readonly delegationDepth?: number
}

/**
 * Whether this session is a delegated child rather than the orchestrator.
 * @param header - durable session header, or the subset assembly already has.
 * @returns `true` when the agent must not receive orchestrator identity.
 */
export function isDelegatedSession(header: DelegatedSessionHeader): boolean {
  return header.origin === 'subagent' || (header.delegationDepth ?? 0) > 0
}

/** One MCP server bound to an employee or the orchestrator. */
export interface BotForgeMcpServer {
  readonly name: string
  readonly command: string
  readonly args: readonly string[]
  readonly env: Readonly<Record<string, string>>
  readonly cwd: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
}

/** User-owned configuration for one employee. */
export interface BotForgeWorkerConfig {
  readonly id: string
  readonly enabled: boolean
  readonly name: string
  readonly role: string
  readonly roleDescription: string
  readonly skills: readonly string[]
  readonly hint: string
  readonly triggers: readonly string[]
  readonly systemPrompt: string
  readonly avatar: string
  readonly avatarSeed: string
  readonly mcp: readonly BotForgeMcpServer[]
}

/** Settings section `botforge-workers`. */
export interface BotForgeWorkersSection {
  readonly workers: readonly BotForgeWorkerConfig[]
}

/** Settings section `botforge-orchestrator`. */
export interface BotForgeOrchestratorSection {
  readonly enabled: boolean
  readonly name: string
  readonly systemPrompt: string
  readonly mcp: readonly BotForgeMcpServer[]
}

/** Default orchestrator persona shown until the user overrides it. */
export const DEFAULT_ORCHESTRATOR_PROMPT = [
  'Ты — главный оркестратор сотрудников (работает в ядре Mako Harness).',
  'Правила:',
  '- Пользователь кидает задачу ОДНОЙ фразой, без пояснений. Прими её и действуй сам.',
  '- Выбери 1–2 ближайших по смыслу сотрудника из списка специалистов ниже.',
  '- Для изолированной работы сотрудника вызывай инструмент delegate_employee с его id, кратким description и полным prompt.',
  '- Каждый сотрудник получает свой системный промпт, скиллы и MCP, заданные пользователем.',
  '- Одна задача — один чат: каждый вызов delegate_employee создаёт НОВЫЙ чат с сотрудником. Для новой задачи создавай новый чат, а не отправляй всё в один; send_message используй только чтобы дополнить ТЕКУЩУЮ задачу в её же чате.',
  '- Делегировал — жди результат: не выполняй задачу сам и не спавни дублирующих сотрудников. list_agents — только по необходимости, не чаще одного раза между событиями; после delegate_employee сразу завершай ход и жди уведомления о завершении.',
  '- Работающему сотруднику можно написать сразу, не дожидаясь завершения: send_message с deliver:"now" прерывает текущий шаг и сообщение выполняется немедленно; без него сообщение встанет в очередь на следующий шаг.',
  '- Если нет точного сотрудника — собери fallback-команду из ближайших: распиши подзадачи, распредели, своди результат.',
  '- Любое сообщение сотрудника видят все; любой может ответить любому в любой момент.',
  '- Веб — только ЛОКАЛЬНО (web_search/web_fetch уже локальные: fetch+cheerio, без платных API и без Redis).',
  '- Делай до конца, без лишних вопросов пользователю.',
].join('\n')

const McpServerSchema = z.object({
  name: z.string().required(),
  command: z.string().default(''),
  args: z.array(String).default([]),
  env: z.dict(String).default({}),
  cwd: z.string().default(''),
  url: z.string().default(''),
  headers: z.dict(String).default({}),
})

/** Schemastery schema for one employee row. */
export const WorkerConfigSchema = z.object({
  id: z.string().required(),
  enabled: z.boolean().default(true),
  name: z.string().required(),
  role: z.string().default(''),
  roleDescription: z.string().default(''),
  skills: z.array(String).default([]),
  hint: z.string().default(''),
  triggers: z.array(String).default([]),
  systemPrompt: z.string().default(''),
  avatar: z.string().default(''),
  avatarSeed: z.string().default(''),
  mcp: z.array(McpServerSchema).default([]),
})

/** Schemastery schema for the employee roster section. */
export const WorkersSectionSchema = z.object({
  workers: z.array(WorkerConfigSchema).default([]),
})

/** Schemastery schema for the orchestrator section, including the master switch. */
export const OrchestratorSectionSchema = z.object({
  enabled: z.boolean().default(true),
  name: z.string().default('Оркестратор'),
  systemPrompt: z.string().default(DEFAULT_ORCHESTRATOR_PROMPT),
  mcp: z.array(McpServerSchema).default([]),
})

/**
 * Built-in roster used as the composition-layer default until the user saves
 * their own employees.
 * @returns a fresh copy of the default employees.
 */
export function defaultWorkers(): BotForgeWorkerConfig[] {
  return WORKERS.map(w => ({
    id: w.id,
    enabled: true,
    name: w.name,
    role: w.role,
    roleDescription: w.role,
    skills: [...w.skills],
    hint: w.hint,
    triggers: w.triggers.map(re => re.source),
    systemPrompt: `Ты — ${w.name} (${w.role}). ${w.hint}.`,
    avatar: w.avatar,
    avatarSeed: w.id,
    mcp: [],
  }))
}

/**
 * Built-in orchestrator section used as the composition-layer default.
 * @returns a fresh copy of the default orchestrator settings.
 */
export function defaultOrchestrator(): BotForgeOrchestratorSection {
  return {
    enabled: true,
    name: 'Оркестратор',
    systemPrompt: DEFAULT_ORCHESTRATOR_PROMPT,
    mcp: [],
  }
}

/**
 * Normalize one MCP row so omitted collections are always arrays/objects.
 * @param raw - stored or default MCP row.
 * @returns a complete MCP row.
 */
export function normalizeMcp(raw: Partial<BotForgeMcpServer> = {}): BotForgeMcpServer {
  return {
    name: raw.name ?? '',
    command: raw.command ?? '',
    args: [...(raw.args ?? [])],
    env: { ...(raw.env ?? {}) },
    cwd: raw.cwd ?? '',
    url: raw.url ?? '',
    headers: { ...(raw.headers ?? {}) },
  }
}

/**
 * Normalize one employee row after a settings read.
 * @param raw - stored or default employee row (sparse fields allowed; they
 *   arrive schema-defaulted on the durable path and hand-built in tests).
 * @returns a complete employee row.
 */
export function normalizeWorker(
  raw: Partial<Omit<BotForgeWorkerConfig, 'id'>> & Pick<BotForgeWorkerConfig, 'id'>,
): BotForgeWorkerConfig {
  return {
    id: raw.id,
    enabled: raw.enabled !== false,
    name: raw.name ?? '',
    role: raw.role ?? '',
    roleDescription: raw.roleDescription ?? '',
    skills: [...(raw.skills ?? [])],
    hint: raw.hint ?? '',
    triggers: [...(raw.triggers ?? [])],
    systemPrompt: raw.systemPrompt ?? '',
    avatar: raw.avatar ?? '',
    avatarSeed: raw.avatarSeed || raw.id,
    mcp: (raw.mcp ?? []).map(normalizeMcp),
  }
}

/**
 * Reject a roster that cannot be addressed by `delegate_employee`.
 * @param value - candidate settings section.
 * @throws when `workers` is missing, or any employee id is empty or duplicated.
 */
export function validateWorkersSection(value: unknown): void {
  const section = typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
  if (!Array.isArray(section?.workers)) throw new Error('botforge-workers: workers must be an array')
  const ids = section.workers.map((worker): unknown =>
    typeof worker === 'object' && worker !== null ? (worker as Record<string, unknown>).id : undefined)
  const isNonEmptyString = (candidate: unknown): candidate is string =>
    typeof candidate === 'string' && candidate.trim() !== ''
  if (!ids.every(isNonEmptyString)) {
    throw new Error('botforge-workers: every worker needs a non-empty id')
  }
  const seen = new Set<string>()
  for (const id of ids.filter(isNonEmptyString)) {
    if (seen.has(id)) throw new Error(`botforge-workers: duplicate worker id "${id}"`)
    seen.add(id)
  }
}

/**
 * Build the durable child label that the Web dock uses to match an employee.
 * @param id - employee id from the roster.
 * @param description - short task description from the model.
 * @returns a label starting with {@link EMPLOYEE_LABEL_PREFIX}.
 */
export function employeeLabel(id: string, description: string): string {
  const task = description.trim()
  return task.length === 0
    ? `${EMPLOYEE_LABEL_PREFIX}${id}`
    : `${EMPLOYEE_LABEL_PREFIX}${id}: ${task}`
}

/**
 * Read an employee id from a child creation label.
 * @param label - persisted subagent label or display title.
 * @returns the employee id, or `undefined` when the label is not prefixed.
 */
export function parseEmployeeId(label: string): string | undefined {
  const match = /^employee:([0-9A-Z_-]+)/i.exec(label.trim())
  return match?.[1]
}

/**
 * Resolve which roster row a child label belongs to.
 * Prefixed labels win; otherwise the first enabled employee whose id or name
 * appears in the label is used so a plain `subagent` call can still surface.
 * @param label - persisted subagent label or display title.
 * @param workers - current roster.
 * @returns the matching employee, or `undefined`.
 */
export function matchEmployee(
  label: string,
  workers: readonly BotForgeWorkerConfig[],
): BotForgeWorkerConfig | undefined {
  const prefixed = parseEmployeeId(label)
  if (prefixed !== undefined) return workers.find(w => w.id === prefixed)
  const q = label.toLowerCase()
  return workers.find(w =>
    w.enabled && (q.includes(w.id.toLowerCase()) || q.includes(w.name.toLowerCase())))
}
