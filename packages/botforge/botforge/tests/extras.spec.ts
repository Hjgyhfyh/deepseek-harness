import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  installEmployeeExtras,
  installEmployeeMcpServer,
  installEmployeeSkills,
  loadEmployeeSkillBodies,
  loadMcpClient,
  mcpServerName,
} from '../src/extras.ts'
import { defaultWorkers } from '../src/config.ts'

function workerWith(over: Partial<ReturnType<typeof defaultWorkers>[number]> = {}) {
  return { ...defaultWorkers()[0]!, ...over }
}

describe('employee extras', () => {
  it('sanitizes MCP server names to 32 safe characters', () => {
    expect(mcpServerName('roblox!', 'My Server', 0)).toMatch(/^[A-Za-z0-9_-]{1,32}$/)
    expect(mcpServerName('x', 'y', 99).length).toBeLessThanOrEqual(32)
  })

  it('skips skill install when there are no names, no services, or no prompt service', async () => {
    const ctx = new Context()
    expect(await loadEmployeeSkillBodies(ctx, workerWith({ skills: [] }), '/tmp', new AbortController().signal)).toBe('')
    await installEmployeeSkills(ctx, workerWith({ skills: [] }), '/tmp', new AbortController().signal)
    await installEmployeeSkills(ctx, workerWith({ skills: ['luau'] }), '/tmp', new AbortController().signal)
    ctx.provide('skills', { get: async () => ({ content: 'body' }) })
    await installEmployeeSkills(ctx, workerWith({ skills: ['luau'] }), '/tmp', new AbortController().signal)
  })

  it('loads skill bodies into a child prompt section and skips missing names', async () => {
    const ctx = new Context()
    const section = vi.fn()
    ctx.provide('skills', {
      get: async (name: string) => name === 'luau' ? { content: '  Luau body  ' } : undefined,
    })
    ctx.provide('systemPrompt', { section })
    await installEmployeeSkills(
      ctx,
      workerWith({ skills: ['luau', ' missing ', ''] }),
      '/workspace',
      new AbortController().signal,
    )
    expect(section).toHaveBeenCalledWith(expect.objectContaining({
      name: 'botforge:employee-skills',
      text: expect.stringContaining('Luau body'),
    }))
  })

  it('skips MCP rows with neither url nor command', async () => {
    const load = vi.fn()
    await installEmployeeMcpServer(new Context(), 'roblox', {
      name: 'empty', command: '', args: [], env: {}, cwd: '', url: '', headers: {},
    }, 0, load)
    expect(load).not.toHaveBeenCalled()
  })

  it('mounts stdio and http MCP plugins and logs a failed start', async () => {
    const ctx = new Context()
    const apply = vi.fn()
    await installEmployeeMcpServer(ctx, 'roblox', {
      name: 'stdio', command: 'npx', args: ['-y', 'x'], env: { A: '1' }, cwd: '/tmp', url: '', headers: {},
    }, 0, async () => ({ apply }))
    expect(apply).toHaveBeenCalled()

    const http = vi.fn()
    await installEmployeeMcpServer(ctx, 'web', {
      name: 'http', command: '', args: [], env: {}, cwd: '', url: 'http://localhost/mcp', headers: { k: 'v' },
    }, 1, async () => ({ apply: http }))
    expect(http).toHaveBeenCalled()

    const warn = vi.fn()
    const failing = new Context()
    Object.assign(failing, { logger: { warn } })
    await installEmployeeMcpServer(failing, 'general', {
      name: 'boom', command: 'nope', args: [], env: {}, cwd: '', url: '', headers: {},
    }, 2, async () => ({ apply: async () => { throw new Error('down') } }))
    expect(warn).toHaveBeenCalled()

    const silent = new Context()
    Object.assign(silent, { logger: {} })
    await installEmployeeMcpServer(silent, 'general', {
      name: '', command: 'nope', args: undefined as never, env: undefined as never,
      cwd: undefined as never, url: undefined as never, headers: undefined as never,
    }, 3, async () => ({ apply: async () => { throw new Error('down') } }))
  })

  it('installs skills then every MCP row', async () => {
    const ctx = new Context()
    ctx.provide('skills', { get: async () => undefined })
    ctx.provide('systemPrompt', { section: vi.fn() })
    await installEmployeeExtras(ctx, workerWith({
      skills: ['x'],
      mcp: [{ name: '', command: '', args: [], env: {}, cwd: '', url: '', headers: {} }],
    }), undefined, new AbortController().signal)
  })

  it('locks spawn tools when the child already has a tools registry', async () => {
    const restrict = vi.fn(() => () => undefined)
    const guard = vi.fn(() => () => undefined)
    const tools = {
      schemas: () => [{ name: 'subagent_fork' }, { name: 'bash' }],
      restrict,
      guard,
    }
    const ctx = {
      agent: {
        id: 'emp-1',
        session: {
          events: [{ type: 'subagent/descriptor', data: { label: 'employee:roblox: shop' } }],
        },
      },
      get: (name: string) => {
        if (name === 'tools') return tools
        if (name === 'skills') return { get: async () => undefined }
        if (name === 'systemPrompt') return { section: vi.fn() }
        return undefined
      },
      tools,
    } as unknown as Context
    await installEmployeeExtras(ctx, workerWith({ skills: [] }), undefined, new AbortController().signal)
    expect(restrict).toHaveBeenCalledWith({ deny: ['subagent_fork'] })
    expect(guard).toHaveBeenCalled()
  })

  it('loads the real mcp-client plugin module', async () => {
    const plugin = await loadMcpClient()
    expect(typeof plugin.apply).toBe('function')
  })
})
