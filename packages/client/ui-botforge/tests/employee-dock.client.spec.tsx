// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId, SessionListState, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { EmployeeDock } from '../src/client/EmployeeDock.tsx'
import type { EmployeeDockProps } from '../src/client/EmployeeDock.tsx'
import { defaultEmployees, defaultOrchestrator } from '../src/client/employees.ts'
import { zh } from '../src/client/locales.ts'

const t: EmployeeDockProps['t'] = makeTranslate(zh, commonZh)

afterEach(cleanup)

function snap<T>(value: T, over: Partial<SettingsScopeSnapshot<T>> = {}): SettingsScopeSnapshot<T> {
  return {
    status: 'ready',
    value,
    base: value,
    user: {},
    revision: 1,
    writable: true,
    mode: 'host',
    ...over,
  }
}

function listState(over: Partial<SessionListState> = {}): SessionListState {
  return {
    ids: ['parent' as SessionId],
    byId: {
      ['parent' as SessionId]: {
        id: 'parent' as SessionId,
        displayTitle: 'Main',
        running: true,
        blank: false,
        updatedAt: 1,
      },
    },
    current: 'parent' as SessionId,
    phase: 'ready',
    subagentsByParent: {
      ['parent' as SessionId]: {
        state: 'ready',
        error: null,
        parentAvailable: true,
        entries: [{
          kind: 'child',
          id: 'child-1' as SessionId,
          mode: 'continuable',
          label: 'employee:roblox: shop',
          activity: 'running',
          hasChildren: false,
        }],
      },
    },
    jobsBySession: {},
    currentAddress: undefined,
    ...over,
  }
}

function renderDock(over: {
  sessions?: SessionListState
  enabled?: boolean
  workers?: ReturnType<typeof defaultEmployees>
} = {}) {
  const openChild = vi.fn()
  const setCatalogOpen = vi.fn()
  const refresh = vi.fn()
  const sessions = over.sessions ?? listState()
  const workersSnap = snap({ workers: over.workers ?? defaultEmployees() })
  const orchSnap = snap({ ...defaultOrchestrator(), enabled: over.enabled !== false })
  const props = {
    t,
    useSessions: ((select: (value: SessionListState) => unknown) => select(sessions)),
    useWorkers: ((select: (value: typeof workersSnap) => unknown) => select(workersSnap)),
    useOrch: ((select: (value: typeof orchSnap) => unknown) => select(orchSnap)),
    openChild,
    setCatalogOpen,
    refresh,
    useWorkspaces: () => undefined,
  } as unknown as EmployeeDockProps
  return { ...render(<EmployeeDock {...props} />), openChild, setCatalogOpen, refresh }
}

describe('EmployeeDock', () => {
  it('renders nothing when the plugin is off or no employee children exist', () => {
    const off = renderDock({ enabled: false })
    expect(off.container.firstChild).toBeNull()
    cleanup()
    const empty = renderDock({
      sessions: listState({ subagentsByParent: {} }),
    })
    expect(empty.container.firstChild).toBeNull()
    cleanup()
    const noParent = renderDock({
      sessions: listState({ current: undefined, ids: [], byId: {}, subagentsByParent: {} }),
    })
    expect(noParent.container.firstChild).toBeNull()
  })

  it('shows a matching employee and opens it from the parent catalog', () => {
    const { openChild, setCatalogOpen, refresh } = renderDock()
    expect(setCatalogOpen).toHaveBeenCalledWith('parent', true)
    expect(refresh).toHaveBeenCalledWith('parent')
    expect(screen.getByText('已委派员工')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '打开 Roblox Scripter' }))
    expect(openChild).toHaveBeenCalledWith({
      parentSessionId: 'parent',
      childSessionId: 'child-1',
      mode: 'continuable',
    })
  })

  it('uses the parent address when viewing a child, and fuzzy-matches unlabeled children', () => {
    const sessions = listState({
      current: 'child-1' as SessionId,
      currentAddress: {
        parentSessionId: 'parent' as SessionId,
        childSessionId: 'child-1' as SessionId,
        mode: 'continuable',
      },
      subagentsByParent: {
        ['parent' as SessionId]: {
          state: 'ready',
          error: null,
          parentAvailable: true,
          entries: [
            {
              kind: 'diagnostic',
              id: 'bad' as SessionId,
              reason: 'corrupt',
            },
            {
              kind: 'child',
              id: 'child-2' as SessionId,
              mode: 'one-shot',
              label: 'ask the Generalist',
              activity: 'inactive',
              hasChildren: false,
            },
          ],
        },
      },
    })
    const { openChild } = renderDock({ sessions })
    fireEvent.click(screen.getByRole('button', { name: '打开 Generalist' }))
    expect(openChild).toHaveBeenCalledWith({
      parentSessionId: 'parent',
      childSessionId: 'child-2',
      mode: 'one-shot',
    })
  })

  it('falls back to the default roster and skips unlabeled or unmatched children', () => {
    const sessions = listState({
      subagentsByParent: {
        ['parent' as SessionId]: {
          state: 'ready',
          error: null,
          parentAvailable: true,
          entries: [
            {
              kind: 'child',
              id: 'child-skip' as SessionId,
              mode: 'one-shot',
              activity: 'inactive',
              hasChildren: false,
            },
            {
              kind: 'child',
              id: 'child-other' as SessionId,
              mode: 'one-shot',
              label: 'totally-unknown-worker',
              activity: 'inactive',
              hasChildren: false,
            },
            {
              kind: 'child',
              id: 'child-1' as SessionId,
              mode: 'continuable',
              label: 'employee:roblox: shop',
              activity: 'inactive',
              hasChildren: false,
            },
          ],
        },
      },
    })
    const openChild = vi.fn()
    const setCatalogOpen = vi.fn()
    const refresh = vi.fn()
    const workersSnap = snap(undefined)
    const orchSnap = snap({ ...defaultOrchestrator(), enabled: true })
    render(<EmployeeDock {...{
      t,
      useSessions: ((select: (value: SessionListState) => unknown) => select(sessions)),
      useWorkers: ((select: (value: typeof workersSnap) => unknown) => select(workersSnap)),
      useOrch: ((select: (value: typeof orchSnap) => unknown) => select(orchSnap)),
      openChild,
      setCatalogOpen,
      refresh,
      useWorkspaces: () => undefined,
    } as unknown as EmployeeDockProps} />)
    expect(screen.getByRole('button', { name: '打开 Roblox Scripter' })).toBeTruthy()
    expect(screen.queryByText('totally-unknown-worker')).toBeNull()
  })
})
