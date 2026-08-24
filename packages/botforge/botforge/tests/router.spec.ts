import { describe, expect, it } from 'vitest'
import { byId, WORKERS } from '../src/workers/definitions.ts'
import { buildEnrichedPrompt, routeWorkers } from '../src/workers/router.ts'

describe('worker definitions and router', () => {
  it('looks up a built-in worker and rejects an unknown id', () => {
    expect(byId('roblox').name).toBe('Roblox Scripter')
    expect(() => byId('nope' as never)).toThrow(/unknown worker/)
    expect(WORKERS).toHaveLength(4)
  })

  it('routes a Roblox trigger as a direct match', () => {
    const result = routeWorkers('сделай roblox обби')
    expect(result.fallback).toBe(false)
    expect(result.ids).toContain('roblox')
  })

  it('routes a web trigger and a telegram trigger', () => {
    expect(routeWorkers('найди документацию').ids).toContain('web')
    expect(routeWorkers('сделай telegram бот').ids).toContain('telegram')
  })

  it('does not route a mailbox instruction to telegram just because the text names Telegram', () => {
    const result = routeWorkers(
      'Почту Telepasta смотри только через mail_codes. Это IMAP catchall@telepasta.ru, не Telegram.',
    )
    expect(result.ids).not.toContain('telegram')
  })

  it('soft-scores a telegram notification task that misses the direct triggers', () => {
    const result = routeWorkers('отправь уведомление по кнопке команды для коллег без домена')
    expect(result.scores.get('telegram')).toBeGreaterThan(0)
  })

  it('uses Generalist for a short off-domain task', () => {
    const result = routeWorkers('привет')
    expect(result.ids).toEqual(['general'])
    expect(result.fallback).toBe(false)
  })

  it('falls back to nearest employees plus Generalist for a long unmatched task', () => {
    const result = routeWorkers('нужно глубоко проанализировать архитектуру продукта и сравнить варианты реализации без явного домена')
    expect(result.fallback).toBe(true)
    expect(result.ids[0]).toBe('general')
  })

  it('adds Generalist to a long direct-match task', () => {
    const long = 'roblox '.repeat(30)
    const result = routeWorkers(long)
    expect(result.fallback).toBe(false)
    expect(result.ids).toContain('roblox')
    expect(result.ids).toContain('general')
  })

  it('builds fallback and direct enriched prompts', () => {
    const direct = buildEnrichedPrompt('task', ['roblox'], false)
    expect(direct.enriched).toContain('Roblox Scripter')
    expect(direct.subtasks[0]?.owner).toBe('roblox')
    const fallback = buildEnrichedPrompt('task', ['general', 'web'], true)
    expect(fallback.enriched).toContain('fallback')
    expect(fallback.subtasks.some((row) => row.owner === 'general')).toBe(true)
  })
})
