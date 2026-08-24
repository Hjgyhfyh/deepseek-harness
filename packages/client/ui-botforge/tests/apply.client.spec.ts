import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import { EmployeesSection } from '../src/client/EmployeesSection.tsx'
import { EmployeeDock } from '../src/client/EmployeeDock.tsx'
import { ORCH_NS, WORKERS_NS } from '../src/client/employees.ts'
import { apply as hostApply } from '../src/index.ts'

usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  new TestRemote(ctx)
  ctx.provide('connection', { api: {}, isLoopback: true } as never)
  const bind = vi.fn((spec: { namespace: string }) => ({
    namespace: spec.namespace,
    getSnapshot: () => ({ status: 'loading', value: undefined }),
    subscribe: () => () => undefined,
    set: vi.fn(async () => undefined),
    unset: vi.fn(async () => undefined),
  }))
  ctx.provide('settingsScope', { bind } as never)
  ctx.provide('sessions', {
    openSubagent: vi.fn(),
    setSubagentCatalogOpen: vi.fn(),
    refreshSubagents: vi.fn(async () => undefined),
  } as never)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, bind }
}

function declareRoot(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      'settings.section': { kind: 'list', scope: 'root' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
}

describe('ui-botforge apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'settingsScope', 'connection', 'remote', 'sessions'])
  })

  it('registers the Employees settings section and overlay dock', async () => {
    const { ctx, slots, bind } = await bench()
    declareRoot(slots)
    await ctx.plugin({ inject: [...inject], apply }).await()

    expect(bind).toHaveBeenCalledWith({ namespace: WORKERS_NS })
    expect(bind).toHaveBeenCalledWith({ namespace: ORCH_NS })
    const section = slots.entries('settings.section')[0]!
    expect(section.component).toBe(EmployeesSection)
    expect(section.options).toMatchObject({ id: 'employees', order: 22 })
    expect(resolveSlotLabel(section.options.label)).toBe('员工')
    const sectionFace = (section.inject as unknown as () => {
      setWorkers: (workers: unknown) => Promise<void>
      setOrch: (field: string, value: unknown) => Promise<void>
    })()
    await sectionFace.setWorkers([])
    await sectionFace.setOrch('enabled', false)

    const dock = slots.entries('shell.overlay')[0]!
    expect(dock.component).toBe(EmployeeDock)
    const dockFace = (dock.inject as unknown as () => {
      openChild: (address: unknown) => void
      setCatalogOpen: (id: string, open: boolean) => void
      refresh: (id: string) => void
    })()
    dockFace.openChild({ parentSessionId: 'p', childSessionId: 'c', mode: 'continuable' })
    dockFace.setCatalogOpen('p', true)
    dockFace.refresh('p')
  })

  it('exposes an empty host apply', () => {
    hostApply()
  })
})
