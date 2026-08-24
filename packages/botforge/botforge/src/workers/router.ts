import { WORKERS, type WorkerKind } from './definitions.ts'

/** Local trigger-router result used by {@link BotForgeService.route}. */
export interface RouteResult {
  /** Chosen employee ids, strongest first. */
  readonly ids: readonly WorkerKind[]
  /** Human-readable routing reason. */
  readonly reason: string
  /** True when no trigger scored a direct match and nearest employees were used. */
  readonly fallback: boolean
  /** Per-employee scores from the last pass. */
  readonly scores: ReadonlyMap<WorkerKind, number>
}

/** True when the task is to read this process's IMAP mailbox, not to operate Telegram. */
function isMailboxInstruction(text: string): boolean {
  return /mail_codes|mail_list_recent|mail_read|\bimap\b|почт[аеуы]|telepasta\.ru|@telepasta/.test(text)
}

/** True when the task is operational Telegram work (send, buttons, broadcasts). */
function isTelegramWork(text: string): boolean {
  return /(отправ|уведом|оповещ|кнопк|рассылк)/i.test(text)
}

function scoreWorkers(text: string): Map<WorkerKind, number> {
  const q = text.toLowerCase()
  const mailbox = isMailboxInstruction(q)
  const m = new Map<WorkerKind, number>()
  for (const w of WORKERS) {
    if (w.id === 'general') { m.set(w.id, 0.15); continue }
    if (w.id === 'telegram' && mailbox && !isTelegramWork(q)) {
      m.set(w.id, 0)
      continue
    }
    const hit = w.triggers.some((re) => re.test(q)) ? 1 : 0
    if (hit === 1) { m.set(w.id, 0.95); continue }
    let soft = 0
    if (w.id === 'web' && /(сделай|создай|найди|как|что|почему|где|когда|анализ|сравни|исследуй|доклад)/i.test(q)) soft += 0.32
    if (w.id === 'roblox' && /(сделай|создай|скрипт|код|игра|механик|магазин|система)/i.test(q)) soft += 0.28
    if (w.id === 'telegram' && /(отправ|уведом|оповещ|кнопк|команд)/i.test(q)) soft += 0.26
    m.set(w.id, soft)
  }
  return m
}

/**
 * Score a free-text task against built-in employee triggers.
 * @param text - user task text.
 * @returns chosen ids, reason, fallback flag, and per-employee scores.
 */
export function routeWorkers(text: string): RouteResult {
  const scores = scoreWorkers(text)
  const scored = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const strong = scored.filter(([, s]) => s >= 0.6).map(([id]) => id).filter((id) => id !== 'general') as WorkerKind[]
  if (strong.length > 0) {
    const needGeneral = text.length > 80 && !strong.includes('general')
    const ids: WorkerKind[] = needGeneral ? [...strong, 'general'] : strong
    return {
      ids,
      reason: `прямое совпадение по триггерам (${strong.join(', ')})`,
      fallback: false,
      scores,
    }
  }
  if (text.trim().length <= 40) {
    return { ids: ['general'], reason: 'короткая задача вне доменов — ведёт Generalist', fallback: false, scores }
  }
  const ranked = scored.filter(([id]) => id !== 'general').slice(0, 2).map(([id]) => id) as WorkerKind[]
  const ids: WorkerKind[] = ['general', ...ranked]
  return {
    ids,
    reason: `нет точного работника — fallback: ближайшие по смыслу (${ranked.join(', ')}) + координатор`,
    fallback: true,
    scores,
  }
}

/**
 * Build an enriched task prompt naming the chosen employees and their skills.
 * @param text - original task.
 * @param ids - employee ids to include.
 * @param fallback - whether the router used fallback scoring.
 * @returns enriched text plus suggested subtasks.
 */
export function buildEnrichedPrompt(text: string, ids: readonly WorkerKind[], fallback: boolean): { enriched: string; subtasks: { title: string; owner: WorkerKind }[] } {
  const workers = ids.map((id) => WORKERS.find((w) => w.id === id)!.name).join(', ')
  const skills = ids.flatMap((id) => WORKERS.find((w) => w.id === id)!.skills).join(', ')
  const fallbackNote = fallback
    ? '\nРежим fallback: разбей задачу на подзадачи, договоритесь кто что берёт, работайте параллельно, общайтесь в общем чате.'
    : ''
  const enriched = [
    `Исходная задача (как кинул пользователь): «${text}»`,
    `Автоподготовка (без промпт-инжиниринга от тебя):`,
    `— Выбраны работники: ${workers}.`,
    `— Их навыки: ${skills}.`,
    `— Контекст: локально, без Redis и без платных web_search API (fetch+cheerio, файл-кеш, sqlite).`,
    `— Правило: любое сообщение работника видят все; любой может ответить любому в любой момент.`,
    fallbackNote,
    `— Делай до конца, без лишних вопросов пользователю.`,
  ].filter(Boolean).join('\n')

  const subtasks: { title: string; owner: WorkerKind }[] = []
  if (fallback) {
    subtasks.push({ title: 'Разбор запроса и план', owner: 'general' })
    for (const id of ids.filter((x) => x !== 'general')) {
      const w = WORKERS.find((x) => x.id === id)!
      subtasks.push({ title: `Часть для ${w.name}: ${w.hint}`, owner: id })
    }
    subtasks.push({ title: 'Сборка и проверка результата', owner: 'general' })
  } else {
    for (const id of ids) {
      const w = WORKERS.find((x) => x.id === id)!
      subtasks.push({ title: `Задача для ${w.name}`, owner: id })
    }
  }
  return { enriched, subtasks }
}


