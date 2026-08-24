import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { registerEmployeeTool } from '../src/tool.ts'
import { defaultWorkers, EMPLOYEE_TOOL_NAME } from '../src/config.ts'
import { employeeSpecialistIdentity } from '../src/prompt.ts'

const signal = new AbortController().signal
const roblox = defaultWorkers().find((w) => w.id === 'roblox')!

function agentWithSession(id = 'parent-1'): Agent {
  const session = Session.create(SessionId(id))
  return { id: SessionId(id), session, ctx: new Context() } as unknown as Agent
}

function delegatedAgent(id = 'child-1'): Agent {
  const session = Session.create(SessionId(id))
  return {
    id: SessionId(id),
    session: { header: { ...session.header, origin: 'subagent', delegationDepth: 1 } },
    ctx: new Context(),
  } as unknown as Agent
}

async function setup(state: Parameters<typeof registerEmployeeTool>[1], subagents: unknown) {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  ctx.provide('subagents', subagents as never)
  registerEmployeeTool(ctx, state)
  return ctx
}

let calls = 0
function execute(ctx: Context, args: unknown, agent?: Agent) {
  return ctx.tools.execute({
    signal,
    callId: CallId(`call-${++calls}`),
    name: EMPLOYEE_TOOL_NAME,
    arguments: args,
    ...agent ? { agent } : {},
  })
}

describe('delegate_employee', () => {
  it('registers a schema with employee_id, description, prompt, and background flag', async () => {
    const ctx = await setup({ enabled: () => true, getWorker: () => roblox }, {
      getProvider: () => ({ capabilities: { persona: true } }),
    })
    const schema = ctx.tools.schemas().find((row) => row.name === EMPLOYEE_TOOL_NAME)
    expect(schema).toBeDefined()
    const props = (schema!.parameters as { properties?: Record<string, unknown> }).properties ?? {}
    expect(Object.keys(props).sort()).toEqual(['description', 'employee_id', 'prompt', 'run_in_background'])
    const tool = ctx.tools.get(EMPLOYEE_TOOL_NAME)!
    expect(tool.presentCall?.({
      employee_id: 'roblox', description: 'shop', prompt: 'build',
    })).toEqual({
      card: 'generic', title: 'shop', kind: 'other', rawInput: 'roblox',
    })
    expect(tool.isConcurrencySafe?.({
      employee_id: 'roblox', description: 'shop', prompt: 'build',
    })).toBe(true)
    expect(tool.output.render({}, {
      kind: 'continuable', subagentId: 'child-1',
    })).toEqual([{ type: 'text', text: 'started employee child-1' }])
    expect(tool.output.render({}, {
      kind: 'foreground',
      runId: 'run-1',
      output: [{ type: 'text', text: 'done' }, { type: 'other' }, 'skip'],
    })).toEqual([{ type: 'text', text: 'done' }])
  })

  it('rejects disabled plugin, missing agent, unknown id, and disabled employee', async () => {
    const disabled = await setup({ enabled: () => false, getWorker: () => roblox }, {
      getProvider: () => ({ capabilities: { persona: true } }),
    })
    expect((await execute(disabled, {
      employee_id: 'roblox', description: 'task', prompt: 'do it',
    }, agentWithSession())).isError).toBe(true)

    const ctx = await setup({ enabled: () => true, getWorker: (id) => id === 'roblox' ? roblox : undefined }, {
      getProvider: () => ({ capabilities: { persona: true } }),
    })
    expect((await execute(ctx, {
      employee_id: 'roblox', description: 'task', prompt: 'do it',
    })).isError).toBe(true)
    expect((await execute(ctx, {
      employee_id: 'nope', description: 'task', prompt: 'do it',
    }, agentWithSession())).isError).toBe(true)

    const off = { ...roblox, enabled: false }
    const disabledWorker = await setup({ enabled: () => true, getWorker: () => off }, {
      getProvider: () => ({ capabilities: { persona: true } }),
    })
    expect((await execute(disabledWorker, {
      employee_id: 'roblox', description: 'task', prompt: 'do it',
    }, agentWithSession())).isError).toBe(true)

    const nested = await setup({ enabled: () => true, getWorker: () => roblox }, {
      getProvider: () => ({ capabilities: { persona: true } }),
    })
    expect((await execute(nested, {
      employee_id: 'roblox', description: 'task', prompt: 'do it',
    }, delegatedAgent())).isError).toBe(true)
  })

  it('rejects a missing subagent service or spawn provider', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    registerEmployeeTool(ctx, { enabled: () => true, getWorker: () => roblox })
    expect((await execute(ctx, {
      employee_id: 'roblox', description: 'task', prompt: 'do it',
    }, agentWithSession())).isError).toBe(true)

    const noSpawn = await setup({ enabled: () => true, getWorker: () => roblox }, {
      getProvider: () => undefined,
    })
    expect((await execute(noSpawn, {
      employee_id: 'roblox', description: 'task', prompt: 'do it',
    }, agentWithSession())).isError).toBe(true)
  })

  it('starts a background continuable child with persona and extras', async () => {
    const childCtx = new Context()
    const startContinuable = vi.fn(async () => ({ childId: 'child-1', messageId: 'm1' }))
    const ctx = await setup({ enabled: () => true, getWorker: () => roblox }, {
      getProvider: () => ({ capabilities: { persona: true } }),
      startContinuable,
    })
    ctx.provide('agents', { get: () => ({ ctx: childCtx }) })
    const routed = vi.fn()
    ctx.on('botforge/routed', routed)
    const result = await execute(ctx, {
      employee_id: 'roblox', description: 'shop', prompt: 'build a shop',
    }, agentWithSession())
    expect(result.isError).toBe(false)
    if (result.isError) throw new Error('expected success')
    expect(result.value).toEqual({ kind: 'continuable', subagentId: 'child-1' })
    expect(startContinuable).toHaveBeenCalled()
    expect(routed).toHaveBeenCalled()
    const request = startContinuable.mock.calls[0]![0] as {
      request: { persona?: string; label: string; toolFilter?: { deny: string[] } }
    }
    expect(request.request.persona).toContain('Roblox')
    expect(request.request.persona).toContain('Assigned skills:')
    expect(request.request.persona).toContain('не оркестратор')
    expect(request.request.label).toContain('employee:roblox')
    expect(request.request.toolFilter).toEqual({ deny: [EMPLOYEE_TOOL_NAME] })
  })

  it('denies parent-visible preset spawn tools such as subagent_fork', async () => {
    const startContinuable = vi.fn(async () => ({ childId: 'child-fork', messageId: 'm-f' }))
    const ctx = await setup({ enabled: () => true, getWorker: () => roblox }, {
      getProvider: () => ({ capabilities: { persona: true } }),
      startContinuable,
    })
    ctx.tools.register(defineTool({
      name: 'subagent_fork',
      description: 'spawn',
      parameters: {},
      output: {
        schema: { type: 'object', additionalProperties: false, properties: {} },
        render: () => [],
      },
      execute: async () => ({}),
    }))
    expect((await execute(ctx, {
      employee_id: 'roblox', description: 'shop', prompt: 'build',
    }, agentWithSession())).isError).toBe(false)
    const request = startContinuable.mock.calls[0]![0] as {
      request: { toolFilter?: { deny: string[] } }
    }
    expect(request.request.toolFilter).toEqual({ deny: [EMPLOYEE_TOOL_NAME, 'subagent_fork'] })
  })

  it('bakes loaded skill bodies into the persona', async () => {
    const startContinuable = vi.fn(async () => ({ childId: 'child-skills', messageId: 'm-s' }))
    const ctx = await setup({ enabled: () => true, getWorker: () => roblox }, {
      getProvider: () => ({ capabilities: { persona: true } }),
      startContinuable,
    })
    ctx.provide('skills', {
      get: async (name: string) => name === 'Luau' ? { content: 'Luau skill body' } : undefined,
    })
    const result = await execute(ctx, {
      employee_id: 'roblox', description: 'shop', prompt: 'build a shop',
    }, agentWithSession())
    expect(result.isError).toBe(false)
    const persona = (startContinuable.mock.calls[0]![0] as { request: { persona?: string } }).request.persona
    expect(persona).toContain('Luau skill body')
    expect(persona).not.toContain('Assigned skills:')
  })

  it('prepends the persona when the provider cannot set one, and skips extras when the child is unpublished', async () => {
    const startContinuable = vi.fn(async () => ({ childId: 'child-2', messageId: 'm2' }))
    const ctx = await setup({
      enabled: () => true,
      getWorker: () => ({ ...roblox, skills: [] }),
    }, {
      getProvider: () => ({ capabilities: { persona: false } }),
      startContinuable,
    })
    const result = await execute(ctx, {
      employee_id: 'roblox', description: 'task', prompt: 'do it',
    }, agentWithSession())
    expect(result.isError).toBe(false)
    const prompt = (startContinuable.mock.calls[0]![0] as {
      request: { prompt: { text: string }[] }
    }).request.prompt[0]!.text
    expect(prompt).toContain('Ты —')
    expect(prompt).toContain('не оркестратор')
    expect(prompt).toContain('do it')

    const empty = vi.fn(async () => ({ childId: 'child-empty', messageId: 'm-e' }))
    const blank = await setup({
      enabled: () => true,
      getWorker: () => ({ ...roblox, skills: [], systemPrompt: '' }),
    }, {
      getProvider: () => ({ capabilities: { persona: false } }),
      startContinuable: empty,
    })
    expect((await execute(blank, {
      employee_id: 'roblox', description: 'task', prompt: 'do it',
    }, agentWithSession())).isError).toBe(false)
    const prepended = (empty.mock.calls[0]![0] as {
      request: { prompt: { text: string }[]; persona?: string }
    }).request.prompt[0]!.text
    expect(prepended).toContain(employeeSpecialistIdentity({ ...roblox, skills: [], systemPrompt: '' }))
    expect(prepended.endsWith('do it')).toBe(true)
  })

  it('still sets the specialist persona when the stored prompt is blank', async () => {
    const startContinuable = vi.fn(async () => ({ childId: 'child-blank', messageId: 'm-b' }))
    const ctx = await setup({
      enabled: () => true,
      getWorker: () => ({ ...roblox, skills: [], systemPrompt: '   ' }),
    }, {
      getProvider: () => ({ capabilities: { persona: true } }),
      startContinuable,
    })
    expect((await execute(ctx, {
      employee_id: 'roblox', description: 'task', prompt: 'do it',
    }, agentWithSession())).isError).toBe(false)
    const request = startContinuable.mock.calls[0]![0] as {
      request: { prompt: { text: string }[]; persona?: string }
    }
    expect(request.request.persona).toBe(
      employeeSpecialistIdentity({ ...roblox, skills: [], systemPrompt: '   ' }),
    )
    expect(request.request.prompt[0]!.text).toBe('do it')
  })

  it('runs in the foreground, installs extras on a local agent, and disposes the run', async () => {
    const dispose = vi.fn(async () => undefined)
    const childCtx = new Context()
    const start = vi.fn(async () => ({
      id: 'run-1',
      localAgent: { ctx: childCtx },
      result: Promise.resolve({
        output: [{ type: 'text', text: 'done' }],
        stopReason: 'completed',
      }),
      dispose,
    }))
    const ctx = await setup({ enabled: () => true, getWorker: () => roblox }, {
      getProvider: () => ({ capabilities: { persona: true } }),
      start,
    })
    const result = await execute(ctx, {
      employee_id: 'roblox',
      description: 'task',
      prompt: 'do it',
      run_in_background: false,
    }, agentWithSession())
    expect(result.isError).toBe(false)
    if (result.isError) throw new Error('expected success')
    expect(result.value).toEqual({
      kind: 'foreground',
      runId: 'run-1',
      output: [{ type: 'text', text: 'done' }],
    })
    expect(dispose).toHaveBeenCalled()
  })

  it('throws when a foreground run does not complete, and skips extras without a local agent', async () => {
    const start = vi.fn(async () => ({
      id: 'run-2',
      localAgent: undefined,
      result: Promise.resolve({ output: [], stopReason: 'error' }),
      dispose: vi.fn(async () => undefined),
    }))
    const ctx = await setup({ enabled: () => true, getWorker: () => roblox }, {
      getProvider: () => ({ capabilities: { persona: true } }),
      start,
    })
    expect((await execute(ctx, {
      employee_id: 'roblox',
      description: 'task',
      prompt: 'do it',
      run_in_background: false,
    }, agentWithSession())).isError).toBe(true)
  })
})
