import { describe, expect, it } from 'vitest'
import {
  defaultEmployees,
  defaultOrchestrator,
  matchEmployee,
  nextEmployeeId,
  normalizeEmployee,
  normalizeMcp,
  parseArgs,
  parseEmployeeId,
  parseSkills,
} from '../src/client/employees.ts'

describe('client employee helpers', () => {
  it('builds defaults and normalizes sparse rows', () => {
    expect(defaultEmployees().length).toBe(4)
    expect(defaultOrchestrator().enabled).toBe(true)
    expect(normalizeMcp(undefined).name).toBe('')
    expect(normalizeMcp({
      name: 'y', command: 'node', args: ['a'], env: { K: 'v' }, cwd: '/tmp',
      url: 'http://localhost/mcp', headers: { h: '1' },
    }).cwd).toBe('/tmp')
    const row = normalizeEmployee({ id: 'x' })
    expect(row.name).toBe('x')
    expect(row.avatarSeed).toBe('x')
    expect(row.enabled).toBe(true)
  })

  it('parses labels, skills, args, and the next custom id', () => {
    expect(parseEmployeeId('employee:web: docs')).toBe('web')
    expect(parseEmployeeId('other')).toBeUndefined()
    expect(parseSkills(' a, a, b, , ')).toEqual(['a', 'b'])
    expect(parseArgs('  --foo   bar ')).toEqual(['--foo', 'bar'])
    expect(nextEmployeeId(['custom-1', 'roblox'])).toBe('custom-2')
  })

  it('matches prefixed labels and enabled fuzzy names', () => {
    const workers = defaultEmployees()
    expect(matchEmployee('employee:telegram: post', workers)?.id).toBe('telegram')
    expect(matchEmployee('ask the Generalist please', workers)?.id).toBe('general')
    const off = workers.map((w) => w.id === 'web' ? { ...w, enabled: false } : w)
    expect(matchEmployee('web search', off)).toBeUndefined()
  })
})
