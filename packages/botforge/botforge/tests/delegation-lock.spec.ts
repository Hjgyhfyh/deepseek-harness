import { describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { EMPLOYEE_TOOL_NAME } from '../src/config.ts'
import {
  creationLabelOf,
  employeeToolFilter,
  isDelegationTool,
  isEmployeeChild,
  lockEmployeeDelegation,
} from '../src/delegation-lock.ts'

function agentWithEvents(
  events: Array<{ type: string; data: { label?: string } }>,
): Agent {
  return {
    id: SessionId('child-1'),
    session: { events, header: { origin: 'subagent', delegationDepth: 1 } },
    ctx: {},
  } as unknown as Agent
}

describe('isDelegationTool', () => {
  it('matches spawn, follow-up, and subagent_* names, and ignores work tools', () => {
    expect(isDelegationTool(EMPLOYEE_TOOL_NAME)).toBe(true)
    expect(isDelegationTool('subagent')).toBe(true)
    expect(isDelegationTool('subagent_fork')).toBe(true)
    expect(isDelegationTool('subagent_codex')).toBe(true)
    expect(isDelegationTool('send_message')).toBe(true)
    expect(isDelegationTool('interrupt_agent')).toBe(true)
    expect(isDelegationTool('list_agents')).toBe(true)
    expect(isDelegationTool('report')).toBe(false)
    expect(isDelegationTool('bash')).toBe(false)
    expect(isDelegationTool('mail_codes')).toBe(false)
    expect(isDelegationTool('mail_list_recent')).toBe(false)
    expect(isDelegationTool('mail_read')).toBe(false)
  })
})

describe('employeeToolFilter', () => {
  it('denies only visible delegation tools', () => {
    const agent = agentWithEvents([])
    expect(employeeToolFilter({ schemas: () => [] }, agent)).toBeUndefined()
    expect(employeeToolFilter({
      schemas: () => [{ name: 'bash' }, { name: 'subagent_fork' }, { name: EMPLOYEE_TOOL_NAME }],
    }, agent)).toEqual({ deny: ['subagent_fork', EMPLOYEE_TOOL_NAME] })
  })
})

describe('lockEmployeeDelegation', () => {
  it('restricts visible spawn tools and guards every delegation name', () => {
    const restrict = vi.fn(() => () => undefined)
    const guard = vi.fn((check: (execution: { name: string }) => string | undefined) => {
      expect(check({ name: 'subagent_fork' })).toBe('employees cannot spawn or steer other agents')
      expect(check({ name: 'bash' })).toBeUndefined()
      return () => undefined
    })
    const dispose = lockEmployeeDelegation({
      schemas: () => [{ name: 'subagent_fork' }, { name: 'bash' }],
      restrict,
      guard,
    }, agentWithEvents([]))
    expect(restrict).toHaveBeenCalledWith({ deny: ['subagent_fork'] })
    expect(guard).toHaveBeenCalled()
    dispose()
  })

  it('registers only the guard when no spawn tool is visible', () => {
    const restrict = vi.fn(() => () => undefined)
    const guard = vi.fn(() => () => undefined)
    lockEmployeeDelegation({
      schemas: () => [{ name: 'bash' }],
      restrict,
      guard,
    }, agentWithEvents([]))
    expect(restrict).not.toHaveBeenCalled()
    expect(guard).toHaveBeenCalled()
  })
})

describe('employee child identity from the descriptor', () => {
  it('reads an employee: label and ignores other children', () => {
    expect(creationLabelOf(agentWithEvents([]))).toBeUndefined()
    expect(isEmployeeChild(agentWithEvents([]))).toBe(false)
    expect(creationLabelOf(agentWithEvents([
      { type: 'subagent/descriptor', data: {} },
    ]))).toBeUndefined()
    const labeled = agentWithEvents([
      { type: 'user/message', data: {} },
      { type: 'subagent/descriptor', data: { label: 'employee:roblox-analyst: game' } },
    ])
    expect(creationLabelOf(labeled)).toBe('employee:roblox-analyst: game')
    expect(isEmployeeChild(labeled)).toBe(true)
    expect(isEmployeeChild(agentWithEvents([
      { type: 'subagent/descriptor', data: { label: 'explore the map' } },
    ]))).toBe(false)
  })
})
