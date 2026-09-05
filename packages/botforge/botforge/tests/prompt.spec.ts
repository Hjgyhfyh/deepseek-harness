import { describe, expect, it } from 'vitest'
import {
  buildEmployeePersona,
  buildOrchestratorSection,
  employeeSpecialistIdentity,
} from '../src/prompt.ts'
import { defaultOrchestrator, defaultWorkers, EMPLOYEE_TOOL_NAME } from '../src/config.ts'

describe('buildOrchestratorSection', () => {
  it('returns an empty string when the plugin is off', () => {
    expect(buildOrchestratorSection(false, defaultOrchestrator(), defaultWorkers())).toBe('')
  })

  it('lists enabled employees, skills, prompts, and MCP', () => {
    const orch = {
      ...defaultOrchestrator(),
      mcp: [{ name: 'orch-mcp', command: 'npx', args: [], env: {}, cwd: '', url: '', headers: {} }],
    }
    const workers = defaultWorkers().map((w) => w.id === 'web'
      ? { ...w, enabled: false }
      : w.id === 'roblox'
        ? { ...w, mcp: [{ name: 'studio', command: '', args: [], env: {}, cwd: '', url: 'http://localhost/mcp', headers: {} }] }
        : w)
    const text = buildOrchestratorSection(true, orch, workers)
    expect(text).toContain(EMPLOYEE_TOOL_NAME)
    expect(text).toContain('roblox:')
    expect(text).not.toContain('web:')
    expect(text).toContain('Orchestrator MCP: orch-mcp')
    expect(text).toContain('studio (http://localhost/mcp)')
    expect(text).toContain('system prompt:')
  })

  it('omits the section for a delegated child even while the plugin is on', () => {
    expect(buildOrchestratorSection(true, defaultOrchestrator(), defaultWorkers(), {
      origin: 'subagent',
    })).toBe('')
    expect(buildOrchestratorSection(true, defaultOrchestrator(), defaultWorkers(), {
      delegationDepth: 1,
    })).toBe('')
    expect(buildOrchestratorSection(true, defaultOrchestrator(), defaultWorkers(), {
      delegationDepth: 0,
    })).toContain(EMPLOYEE_TOOL_NAME)
  })

  it('falls back to the default orchestrator prompt and an empty roster line', () => {
    const text = buildOrchestratorSection(true, {
      enabled: true, name: 'O', systemPrompt: '   ', mcp: [],
    }, [])
    expect(text).toContain('(no enabled employees)')
    expect(text).toContain('Delegate with')
  })

  it('uses role descriptions, skips empty fields, and renders MCP command or dash', () => {
    const worker = {
      ...defaultWorkers()[0]!,
      hint: '',
      skills: [],
      systemPrompt: '   ',
      mcp: [
        { name: 'stdio', command: 'npx', args: [], env: {}, cwd: '', url: '', headers: {} },
        { name: 'blank', command: '', args: [], env: {}, cwd: '', url: '', headers: {} },
      ],
    }
    const text = buildOrchestratorSection(true, {
      enabled: true,
      name: 'O',
      systemPrompt: 'Lead.',
      mcp: [
        { name: 'http', command: '', args: [], env: {}, cwd: '', url: 'http://orch', headers: {} },
        { name: 'none', command: '', args: [], env: {}, cwd: '', url: '', headers: {} },
      ],
    }, [worker])
    expect(text).toContain(worker.roleDescription)
    expect(text).not.toContain('skills:')
    expect(text).not.toContain('system prompt:')
    expect(text).toContain('stdio (npx)')
    expect(text).toContain('blank (—)')
    expect(text).toContain('http (http://orch)')
    expect(text).toContain('none (—)')
  })
})

describe('buildEmployeePersona', () => {
  it('leads with specialist identity, then stored prompt, skills, or a name fallback', () => {
    const worker = defaultWorkers().find((w) => w.id === 'roblox')!
    const identity = employeeSpecialistIdentity(worker)
    expect(identity).toContain(`id ${worker.id}`)
    expect(identity).toContain('не оркестратор')
    const withBodies = buildEmployeePersona(worker, '## Luau\nbody')
    expect(withBodies.startsWith(identity)).toBe(true)
    expect(withBodies).toContain(worker.systemPrompt.trim())
    expect(withBodies).toContain('## Luau\nbody')
    expect(withBodies).not.toContain('Assigned skills:')
    const blank = { ...worker, systemPrompt: '   ', skills: [] }
    expect(buildEmployeePersona(blank, '')).toBe(employeeSpecialistIdentity(blank))
    const named = { ...worker, systemPrompt: '', skills: ['Luau', ''] }
    expect(buildEmployeePersona(named, '')).toContain('Assigned skills: Luau')
  })
})
