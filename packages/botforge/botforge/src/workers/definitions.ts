/** Built-in employee id used by the local trigger router. */
export type WorkerKind = 'roblox' | 'web' | 'telegram' | 'general'

/** Built-in employee row used as the composition-layer roster seed. */
export interface WorkerDef {
  /** Stable roster id; also the default `delegate_employee` employee_id. */
  readonly id: WorkerKind
  /** Display name. */
  readonly name: string
  /** Short role line shown in the roster. */
  readonly role: string
  /** Skill names the default persona claims. */
  readonly skills: readonly string[]
  /** One-line capability hint used in routing copy. */
  readonly hint: string
  /** Case-insensitive triggers that score this employee as a direct match. */
  readonly triggers: readonly RegExp[]
  /** Emoji glyph used as a compact avatar fallback. */
  readonly avatar: string
}

/** Built-in employees shipped as the default roster. */
export const WORKERS: readonly WorkerDef[] = [
  {
    id: 'roblox',
    name: 'Roblox Scripter',
    role: 'Luau · Roblox Studio · Rojo',
    skills: ['Luau', 'DataStore', 'RemoteEvents', 'Rojo', 'Obby/Магазин'],
    hint: 'Пишет скрипты, места, магазины, сохраняет прогресс',
    triggers: [/роблокс|roblox|luau|скрипт|obby|обби|магазин|place|studio|модель|место/i],
    avatar: '🎮',
  },
  {
    id: 'web',
    name: 'Web Searcher',
    role: 'Поиск и чтение — локально',
    skills: ['fetch', 'cheerio', 'markdown', 'файл-кеш'],
    hint: 'Ищет через fetch+парсинг HTML, без платных API и без Redis',
    triggers: [/поиск|найди|гугл|веб|сайт|статья|парс|ссылк|документац|почитай|что такое/i],
    avatar: '🔍',
  },
  {
    id: 'telegram',
    name: 'Telegram Manager',
    role: 'Бот и рассылки — локально',
    skills: ['grammY', 'long-polling', 'inline-кнопки', 'файлы'],
    hint: 'Управляет ботом, командами, каналами, рассылками',
    triggers: [/телеграм|telegram|тг[\s.,!]|канал|рассылк/i],
    avatar: '✈️',
  },
  {
    id: 'general',
    name: 'Generalist',
    role: 'Универсал · fallback · координатор',
    skills: ['планирование', 'координация', 'разбиение задачи'],
    hint: 'Собирает fallback-команду и ведёт задачу до конца',
    triggers: [],
    avatar: '🧠',
  },
] as const

/**
 * Look up a built-in employee by id.
 * @param id - roster id.
 * @returns the built-in row.
 * @throws when `id` is not one of the shipped employees.
 */
export function byId(id: WorkerKind): WorkerDef {
  const w = WORKERS.find((x) => x.id === id)
  if (!w) throw new Error(`unknown worker ${id}`)
  return w
}
