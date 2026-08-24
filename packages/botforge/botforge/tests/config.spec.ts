import { describe, expect, it } from 'vitest'
import {
  defaultOrchestrator,
  defaultWorkers,
  employeeLabel,
  matchEmployee,
  normalizeMcp,
  normalizeWorker,
  parseEmployeeId,
  isDelegatedSession,
  validateWorkersSection,
  EMPLOYEE_LABEL_PREFIX,
} from '../src/config.ts'

describe('botforge config', () => {
  it('builds a default roster with unique ids and default orchestrator enabled', () => {
    const workers = defaultWorkers()
    expect(new Set(workers.map((w) => w.id)).size).toBe(workers.length)
    expect(workers.every((w) => w.enabled)).toBe(true)
    expect(defaultOrchestrator().enabled).toBe(true)
  })

  it('normalizes omitted MCP collections and keeps supplied cwd, url, and headers', () => {
    expect(normalizeMcp({ name: 'x', command: 'npx' })).toEqual({
      name: 'x',
      command: 'npx',
      args: [],
      env: {},
      cwd: '',
      url: '',
      headers: {},
    })
    expect(normalizeMcp({
      name: 'y',
      command: 'node',
      args: ['a'],
      env: { K: 'v' },
      cwd: '/tmp',
      url: 'http://localhost/mcp',
      headers: { h: '1' },
    })).toEqual({
      name: 'y',
      command: 'node',
      args: ['a'],
      env: { K: 'v' },
      cwd: '/tmp',
      url: 'http://localhost/mcp',
      headers: { h: '1' },
    })
    expect(normalizeMcp().name).toBe('')
  })

  it('normalizes a worker and fills avatarSeed from id', () => {
    const raw = defaultWorkers()[0]!
    const next = normalizeWorker({ ...raw, enabled: undefined as never, avatarSeed: '' })
    expect(next.enabled).toBe(true)
    expect(next.avatarSeed).toBe(raw.id)
    expect(next.skills).toEqual(raw.skills)
    const sparse = normalizeWorker({
      ...raw,
      skills: undefined as never,
      triggers: undefined as never,
      mcp: undefined as never,
    })
    expect(sparse.skills).toEqual([])
    expect(sparse.triggers).toEqual([])
    expect(sparse.mcp).toEqual([])
  })

  it('rejects a missing workers array, empty ids, and duplicates', () => {
    expect(() => validateWorkersSection({})).toThrow(/must be an array/)
    expect(() => validateWorkersSection({ workers: [{ id: '  ' }] })).toThrow(/non-empty id/)
    expect(() => validateWorkersSection({ workers: [{ id: 'a' }, { id: 'a' }] })).toThrow(/duplicate/)
    validateWorkersSection({ workers: [{ id: 'a' }, { id: 'b' }] })
  })

  it('builds and parses employee labels', () => {
    expect(employeeLabel('roblox', '  shop  ')).toBe(`${EMPLOYEE_LABEL_PREFIX}roblox: shop`)
    expect(employeeLabel('roblox', '   ')).toBe(`${EMPLOYEE_LABEL_PREFIX}roblox`)
    expect(parseEmployeeId('employee:web: fetch docs')).toBe('web')
    expect(parseEmployeeId('plain subagent')).toBeUndefined()
  })

  it('matches a prefixed label before fuzzy id/name search', () => {
    const workers = defaultWorkers()
    expect(matchEmployee('employee:telegram: post', workers)?.id).toBe('telegram')
    expect(matchEmployee('Please ask the Generalist', workers)?.id).toBe('general')
    expect(matchEmployee('nobody here', workers)).toBeUndefined()
  })

  it('skips disabled employees on fuzzy match', () => {
    const workers = defaultWorkers().map((w) => w.id === 'web' ? { ...w, enabled: false } : w)
    expect(matchEmployee('web search please', workers)).toBeUndefined()
  })

  it('treats subagent origin or positive depth as a delegated child', () => {
    expect(isDelegatedSession({})).toBe(false)
    expect(isDelegatedSession({ delegationDepth: 0 })).toBe(false)
    expect(isDelegatedSession({ origin: 'subagent' })).toBe(true)
    expect(isDelegatedSession({ delegationDepth: 1 })).toBe(true)
  })
})
