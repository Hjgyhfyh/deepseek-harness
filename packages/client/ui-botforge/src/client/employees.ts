/**
 * Client-local employee roster types and matching. Namespace strings and
 * label prefixes are spelled here rather than imported: a client package
 * must not depend on a Host package.
 * @module @deepseek-ai/dsh-client-ui-botforge/employees
 */

/** Host settings namespace for the employee roster. */
export const WORKERS_NS = 'botforge-workers'
/** Host settings namespace for the orchestrator, including the master switch. */
export const ORCH_NS = 'botforge-orchestrator'
/** Creation-label prefix persisted on a delegated child session. */
export const EMPLOYEE_LABEL_PREFIX = 'employee:'

/** One MCP server bound to an employee or the orchestrator. */
export interface EmployeeMcpServer {
  readonly name: string
  readonly command: string
  readonly args: readonly string[]
  readonly env: Readonly<Record<string, string>>
  readonly cwd: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
}

/** User-owned configuration for one employee. */
export interface EmployeeConfig {
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
  readonly mcp: readonly EmployeeMcpServer[]
}

/** Settings section `botforge-workers`. */
export interface EmployeesSectionValue {
  readonly workers: readonly EmployeeConfig[]
}

/** Settings section `botforge-orchestrator`. */
export interface OrchestratorSectionValue {
  readonly enabled: boolean
  readonly name: string
  readonly systemPrompt: string
  readonly mcp: readonly EmployeeMcpServer[]
}

const DEFAULT_ORCH_PROMPT = [
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

/**
 * Built-in roster used until the Host settings document supplies one.
 * @returns a fresh copy of the default employees.
 */
export function defaultEmployees(): EmployeeConfig[] {
  return [
    {
      id: 'roblox', enabled: true, name: 'Roblox Scripter', role: 'Luau · Roblox Studio · Rojo',
      roleDescription: 'Luau · Roblox Studio · Rojo',
      skills: ['Luau', 'DataStore', 'RemoteEvents', 'Rojo', 'Obby/Магазин'],
      hint: 'Пишет скрипты, места, магазины, сохраняет прогресс',
      triggers: ['роблокс|roblox|luau|скрипт|obby|обби|магазин|place|studio|модель|место'],
      systemPrompt: 'Ты — Roblox Scripter (Luau · Roblox Studio · Rojo). Пишет скрипты, места, магазины, сохраняет прогресс.',
      avatar: '🎮', avatarSeed: 'roblox', mcp: [],
    },
    {
      id: 'web', enabled: true, name: 'Web Searcher', role: 'Поиск и чтение — локально',
      roleDescription: 'Поиск и чтение — локально',
      skills: ['fetch', 'cheerio', 'markdown', 'файл-кеш'],
      hint: 'Ищет через fetch+парсинг HTML, без платных API и без Redis',
      triggers: ['поиск|найди|гугл|веб|сайт|статья|парс|ссылк|документац|почитай|что такое'],
      systemPrompt: 'Ты — Web Searcher (Поиск и чтение — локально). Ищет через fetch+парсинг HTML, без платных API и без Redis.',
      avatar: '🔍', avatarSeed: 'web', mcp: [],
    },
    {
      id: 'telegram', enabled: true, name: 'Telegram Manager', role: 'Бот и рассылки — локально',
      roleDescription: 'Бот и рассылки — локально',
      skills: ['grammY', 'long-polling', 'inline-кнопки', 'файлы'],
      hint: 'Управляет ботом, командами, каналами, рассылками',
      triggers: ['телеграм|telegram|тг[ \\s.,!]|бот|канал|рассылк|сообщен'],
      systemPrompt: 'Ты — Telegram Manager (Бот и рассылки — локально). Управляет ботом, командами, каналами, рассылками.',
      avatar: '✈️', avatarSeed: 'telegram', mcp: [],
    },
    {
      id: 'general', enabled: true, name: 'Generalist', role: 'Универсал · fallback · координатор',
      roleDescription: 'Универсал · fallback · координатор',
      skills: ['планирование', 'координация', 'разбиение задачи'],
      hint: 'Собирает fallback-команду и ведёт задачу до конца',
      triggers: [],
      systemPrompt: 'Ты — Generalist (Универсал · fallback · координатор). Собирает fallback-команду и ведёт задачу до конца.',
      avatar: '🧠', avatarSeed: 'general', mcp: [],
    },
  ]
}

/**
 * Built-in orchestrator section used until the Host settings document supplies one.
 * @returns a fresh copy of the default orchestrator settings.
 */
export function defaultOrchestrator(): OrchestratorSectionValue {
  return {
    enabled: true,
    name: 'Оркестратор',
    systemPrompt: DEFAULT_ORCH_PROMPT,
    mcp: [],
  }
}

/**
 * Normalize one MCP row so omitted collections are always arrays/objects.
 * @param raw - stored or draft MCP row.
 * @returns a complete MCP row.
 */
export function normalizeMcp(raw: Partial<EmployeeMcpServer> | undefined): EmployeeMcpServer {
  return {
    name: raw?.name ?? '',
    command: raw?.command ?? '',
    args: [...(raw?.args ?? [])],
    env: { ...(raw?.env ?? {}) },
    cwd: raw?.cwd ?? '',
    url: raw?.url ?? '',
    headers: { ...(raw?.headers ?? {}) },
  }
}

/**
 * Normalize one employee row after a settings read or editor draft.
 * @param raw - stored or draft employee row.
 * @returns a complete employee row.
 */
export function normalizeEmployee(raw: Partial<EmployeeConfig> & Pick<EmployeeConfig, 'id'>): EmployeeConfig {
  return {
    id: raw.id,
    enabled: raw.enabled !== false,
    name: raw.name ?? raw.id,
    role: raw.role ?? '',
    roleDescription: raw.roleDescription ?? raw.role ?? '',
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
  workers: readonly EmployeeConfig[],
): EmployeeConfig | undefined {
  const prefixed = parseEmployeeId(label)
  if (prefixed !== undefined) return workers.find((w) => w.id === prefixed)
  const q = label.toLowerCase()
  return workers.find((w) =>
    w.enabled && (q.includes(w.id.toLowerCase()) || q.includes(w.name.toLowerCase())))
}

/**
 * Split a comma-separated skills field into trimmed unique names.
 * @param text - editor text.
 * @returns skill names.
 */
export function parseSkills(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(',')) {
    const name = part.trim()
    if (name === '' || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

/**
 * Split an arguments field on whitespace into argv tokens.
 * @param text - editor text.
 * @returns argument tokens.
 */
export function parseArgs(text: string): string[] {
  return text.split(/\s+/).map((part) => part.trim()).filter(Boolean)
}

/**
 * Allocate a unique employee id that is not already on the roster.
 * @param existing - current ids.
 * @returns a new `custom-N` id.
 */
export function nextEmployeeId(existing: readonly string[]): string {
  const taken = new Set(existing)
  let n = 1
  while (taken.has(`custom-${String(n)}`)) n += 1
  return `custom-${String(n)}`
}
