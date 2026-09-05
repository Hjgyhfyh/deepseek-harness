/**
 * Right-side dock of employees the current session (or its parent) has
 * delegated. Hidden while the plugin is off or no matching child exists.
 */

import { useEffect, useMemo } from 'react'
import type { SessionId, SubagentAddress } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronRightOutline14, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { EmployeeAvatar } from './EmployeeAvatar.tsx'
import {
  defaultEmployees,
  matchEmployee,
  type EmployeeConfig,
  type EmployeesSectionValue,
  type OrchestratorSectionValue,
} from './employees.ts'
import type { EmployeesKey } from './locales.ts'
import css from './EmployeeDock.module.css'

/** Registration-side business face for the live employee dock. */
export interface EmployeeDockInjected {
  hooks: {
    /** Host `botforge-workers` namespace. */
    workers: SettingsScope<EmployeesSectionValue>
    /** Host `botforge-orchestrator` namespace. */
    orch: SettingsScope<OrchestratorSectionValue>
  }
  /**
   * Open a healthy catalog child through its exact direct-parent address.
   * @param address - catalog-derived parent and child ids.
   */
  openChild: (address: SubagentAddress) => void
  /**
   * Mark whether this dock is consuming live membership updates.
   * @param parentSessionId - catalog owner.
   * @param open - current dock occupancy.
   */
  setCatalogOpen: (parentSessionId: SessionId, open: boolean) => void
  /**
   * Refresh one direct-child catalog.
   * @param parentSessionId - catalog owner.
   */
  refresh: (parentSessionId: SessionId) => void
}

/** Props the renderer binds for the dock. */
export type EmployeeDockProps =
  PropsRuntime<'shell.overlay'>
  & PropsLocale<'employees'>
  & InjectFace<EmployeeDockInjected>

function openLabel(template: string, name: string): string {
  return template.replace('{name}', name)
}

/**
 * Render the live employee rail, or nothing when the plugin is off / idle.
 * @param props - locale copy, session list, settings snapshots, and open verbs.
 * @returns the rail, or `null`.
 */
export function EmployeeDock(props: EmployeeDockProps): React.ReactNode {
  const { t, useSessions, useWorkers, useOrch, openChild, setCatalogOpen, refresh } = props
  const sessions = useSessions((snapshot) => snapshot)
  const workersSnap = useWorkers((snapshot) => snapshot)
  const orchSnap = useOrch((snapshot) => snapshot)
  const enabled = orchSnap.value?.enabled !== false
  const storedWorkers = workersSnap.value?.workers
  const workers = useMemo(
    () => (storedWorkers !== undefined && storedWorkers.length > 0
      ? storedWorkers
      : defaultEmployees()),
    [storedWorkers],
  )
  const parentId = sessions.currentAddress?.parentSessionId ?? sessions.current

  const items = useMemo(() => {
    if (!enabled || parentId === undefined) return []
    const catalog = sessions.subagentsByParent[parentId]
    const out: {
      id: SessionId
      mode: 'one-shot' | 'continuable'
      activity: 'running' | 'inactive'
      worker: EmployeeConfig
    }[] = []
    for (const entry of catalog?.entries ?? []) {
      if (entry.kind !== 'child') continue
      const worker = matchEmployee(entry.label ?? '', workers)
      if (worker === undefined) continue
      out.push({ id: entry.id, mode: entry.mode, activity: entry.activity, worker })
    }
    return out
  }, [enabled, parentId, sessions.subagentsByParent, workers])

  useEffect(() => {
    if (!enabled || parentId === undefined) return
    setCatalogOpen(parentId, true)
    refresh(parentId)
    return () => { setCatalogOpen(parentId, false) }
  }, [enabled, parentId, refresh, setCatalogOpen])

  if (!enabled || items.length === 0 || parentId === undefined) return null

  return (
    <aside className={css.dock} aria-label={t('dockLabel' satisfies EmployeesKey)}>
      <div className={css.head}>
        <span className={css.caption}>{t('dockLabel')}</span>
        <span className={css.headCount}>{items.length}</span>
      </div>
      {items.map((item, index) => {
        const label = openLabel(t('openEmployee'), item.worker.name)
        const running = item.activity === 'running'
        return (
          <Tooltip key={item.id} label={label} side="top">
            <button
              type="button"
              className={`${css.chip}${running ? ` ${css.chipLive}` : ''}`}
              aria-label={label}
              onClick={() => {
                openChild({ parentSessionId: parentId, childSessionId: item.id, mode: item.mode })
              }}
            >
              <span className={css.index}>{String(index + 1).padStart(2, '0')}</span>
              <EmployeeAvatar name={item.worker.name} seed={item.worker.avatarSeed} size={38} />
              <span className={css.meta}>
                <span className={css.nameRow}>
                  <span className={css.name}>{item.worker.name}</span>
                  {running && <span className={css.livePill}><span className={css.liveDot} />{t('dockLive')}</span>}
                </span>
                {item.worker.role !== '' && <span className={css.role}>{item.worker.role}</span>}
              </span>
              <IconChevronRightOutline14 size={12} className={css.go} />
            </button>
          </Tooltip>
        )
      })}
    </aside>
  )
}
