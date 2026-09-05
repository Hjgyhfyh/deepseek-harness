import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import { CallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as botforge from '../src/index.ts'
import { defaultOrchestrator, defaultWorkers } from '../src/config.ts'

function fakeSettings(
  workers: { workers: ReturnType<typeof defaultWorkers> } | undefined = { workers: defaultWorkers() },
  orch: ReturnType<typeof defaultOrchestrator> | undefined = defaultOrchestrator(),
) {
  const watchers: Array<() => void> = []
  let workersValue = workers
  let orchValue = orch
  return {
    service: {
      register: (ns: { toString?: () => string } | string) => {
        const name = String(ns)
        return {
          get: () => name.includes('orchestrator') ? orchValue : workersValue,
          watch: (cb: () => void) => {
            watchers.push(cb)
            return () => undefined
          },
        }
      },
    },
    commit(
      nextWorkers: typeof workersValue = workersValue,
      nextOrch: typeof orchValue = orchValue,
    ) {
      workersValue = nextWorkers
      orchValue = nextOrch
      for (const cb of watchers) cb()
    },
  }
}

function parentAgent(): Agent {
  const session = Session.create(SessionId('parent-1'))
  return { id: SessionId('parent-1'), session, ctx: new Context() } as unknown as Agent
}

function employeeAgent(): Agent {
  return {
    id: SessionId('emp-1'),
    session: {
      events: [{ type: 'subagent/descriptor', data: { label: 'employee:roblox: shop' } }],
      header: { origin: 'subagent', delegationDepth: 1 },
    },
    ctx: new Context(),
  } as unknown as Agent
}

const spawnTool = defineTool({
  name: 'subagent_fork',
  description: 'spawn',
  parameters: {},
  output: {
    schema: { type: 'object', additionalProperties: false, properties: {} },
    render: () => [],
  },
  execute: async () => ({}),
})

describe('botforge apply', () => {
  it('provides the service, prompt section, and tool, then remounts on disable', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const settings = fakeSettings()
    ctx.provide('settings', settings.service as never)
    const startContinuable = vi.fn(async () => ({ childId: 'child-1', messageId: 'm1' }))
    let continuableSetup: ((childCtx: Context) => () => void) | undefined
    ctx.provide('subagents', {
      getProvider: () => ({ capabilities: { persona: true } }),
      startContinuable,
      registerContinuableSetup: (contribution: (childCtx: Context) => () => void) => {
        continuableSetup = contribution
        return () => undefined
      },
    } as never)

    const fiber = ctx.plugin({ name: 'botforge-under-test', apply: botforge.apply })
    await fiber.await()

    expect(ctx.botforge.listWorkers().length).toBeGreaterThan(0)
    expect(ctx.botforge.getWorker('roblox')?.id).toBe('roblox')
    expect(ctx.botforge.getWorker('missing')).toBeUndefined()
    expect(ctx.botforge.orchestrator().enabled).toBe(true)
    expect(botforge.pluginEnabled()).toBe(true)
    expect(botforge.currentWorkerConfigs().length).toBeGreaterThan(0)
    expect(ctx.botforge.route('найди статью').ids).toContain('web')
    const enriched = ctx.botforge.enrich('task', ['roblox'], false)
    expect(enriched.enriched).toContain('Roblox')

    expect(renderPrompt(await ctx.systemPrompt.assemble())).toContain(botforge.EMPLOYEE_TOOL_NAME)
    expect(renderPrompt(await ctx.systemPrompt.assemble({ agent: parentAgent() })))
      .toContain(botforge.EMPLOYEE_TOOL_NAME)
    const child = {
      session: { header: { origin: 'subagent', delegationDepth: 1 } },
    } as unknown as Agent
    expect(renderPrompt(await ctx.systemPrompt.assemble({ agent: child })))
      .not.toContain(botforge.EMPLOYEE_TOOL_NAME)
    expect(ctx.tools.schemas().some((row) => row.name === botforge.EMPLOYEE_TOOL_NAME)).toBe(true)

    const delegated = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('call-index'),
      name: botforge.EMPLOYEE_TOOL_NAME,
      arguments: { employee_id: 'roblox', description: 'shop', prompt: 'build' },
      agent: parentAgent(),
    })
    expect(delegated.isError).toBe(false)
    expect(startContinuable).toHaveBeenCalled()

    ctx.tools.register(spawnTool)
    const parentSpawn = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('call-parent-spawn'),
      name: 'subagent_fork',
      arguments: {},
      agent: parentAgent(),
    })
    expect(parentSpawn.isError).toBe(false)
    const employeeSpawn = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('call-employee-spawn'),
      name: 'subagent_fork',
      arguments: {},
      agent: employeeAgent(),
    })
    expect(employeeSpawn.isError).toBe(true)

    const restrict = vi.fn(() => () => undefined)
    const guard = vi.fn(() => () => undefined)
    const childTools = {
      schemas: () => [{ name: 'subagent_fork' }, { name: 'bash' }],
      restrict,
      guard,
    }
    const employeeCtx = {
      agent: employeeAgent(),
      get: (name: string) => name === 'tools' ? childTools : undefined,
      tools: childTools,
    } as unknown as Context
    expect(continuableSetup).toBeDefined()
    continuableSetup!(employeeCtx)
    expect(restrict).toHaveBeenCalledWith({ deny: ['subagent_fork'] })
    restrict.mockClear()
    const genericCtx = {
      agent: {
        id: SessionId('generic-1'),
        session: {
          events: [{ type: 'subagent/descriptor', data: { label: 'explore the map' } }],
          header: { origin: 'subagent', delegationDepth: 1 },
        },
        ctx: new Context(),
      },
      get: (name: string) => name === 'tools' ? childTools : undefined,
      tools: childTools,
    } as unknown as Context
    continuableSetup!(genericCtx)
    expect(restrict).not.toHaveBeenCalled()

    const withBlankMcp = defaultWorkers().map((w) => w.id === 'roblox'
      ? {
        ...w,
        mcp: [
          { name: 'blank', command: '', args: [], env: {}, cwd: '', url: '', headers: {} },
          { name: 'http', command: '', args: [], env: {}, cwd: '', url: 'http://x', headers: {} },
        ],
      }
      : w)
    settings.commit({ workers: withBlankMcp }, defaultOrchestrator())
    expect(ctx.botforge.enrich('task', ['roblox'], false).enriched).toContain('blank (—)')
    expect(ctx.botforge.enrich('task', ['roblox'], false).enriched).toContain('http (http://x)')

    settings.commit({ workers: defaultWorkers() }, { ...defaultOrchestrator(), enabled: false })
    expect(botforge.pluginEnabled()).toBe(false)
    expect(ctx.tools.schemas().some((row) => row.name === botforge.EMPLOYEE_TOOL_NAME)).toBe(false)
    expect(renderPrompt(await ctx.systemPrompt.assemble())).not.toContain(botforge.EMPLOYEE_TOOL_NAME)

    settings.commit({ workers: [] as never }, defaultOrchestrator())
    expect(ctx.botforge.listWorkers().length).toBeGreaterThan(0)
    settings.commit({ workers: defaultWorkers() }, { enabled: true, name: '', systemPrompt: '' } as never)
    expect(ctx.botforge.orchestrator().name).toBe('Оркестратор')
    expect(ctx.botforge.orchestrator().mcp).toEqual([])
    settings.commit({ workers: defaultWorkers() }, {
      enabled: true,
      name: 'Lead',
      systemPrompt: 'go',
      mcp: [{ name: 'x', command: 'npx' }],
    } as never)
    expect(ctx.botforge.orchestrator().mcp[0]).toEqual({
      name: 'x', command: 'npx', args: [], env: {}, cwd: '', url: '', headers: {},
    })
    settings.commit(undefined, undefined)
    expect(ctx.botforge.listWorkers().length).toBeGreaterThan(0)
    expect(ctx.botforge.orchestrator().enabled).toBe(true)
    await fiber.dispose()
  })

  it('enriches with live skills, prompts, and MCP, and logs routed tasks', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    const workers = defaultWorkers().map((w) => w.id === 'roblox'
      ? {
        ...w,
        skills: [],
        systemPrompt: '   ',
        mcp: [{ name: 'studio', command: 'npx', args: [], env: {}, cwd: '', url: '', headers: {} }],
      }
      : w)
    const settings = fakeSettings({ workers }, defaultOrchestrator())
    ctx.provide('settings', settings.service as never)
    const fiber = ctx.plugin({ name: 'botforge-under-test', apply: botforge.apply })
    await fiber.await()
    settings.commit({ workers }, defaultOrchestrator())
    const payload = ctx.botforge.enrich('build', ['roblox'], true)
    expect(payload.enriched).toContain('скиллы: —')
    expect(payload.enriched).toContain('MCP:')
    expect(payload.enriched).not.toContain('системный промпт:')
    ctx.emit('botforge/routed', {
      taskId: 't1',
      text: 'hello world this is a long enough task description',
      ids: ['roblox'],
      fallback: false,
      enriched: 'x'.repeat(20),
    })
  })
})
