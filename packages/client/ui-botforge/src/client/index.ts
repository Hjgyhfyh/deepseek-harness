/**
 * Employees surface plugin, browser half: Settings → Employees for the
 * roster and master switch, plus a right-side dock of employees the current
 * session has delegated through `delegate_employee`.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { EmployeeDock } from './EmployeeDock.tsx'
import type { EmployeeDockInjected } from './EmployeeDock.tsx'
import { EmployeesSection } from './EmployeesSection.tsx'
import type { EmployeesSectionInjected } from './EmployeesSection.tsx'
import { ORCH_NS, WORKERS_NS, type EmployeesSectionValue, type OrchestratorSectionValue } from './employees.ts'
import { en, zh, type EmployeesKey } from './locales.ts'

export type { EmployeesKey } from './locales.ts'
export type { EmployeesSectionInjected, EmployeesSectionProps } from './EmployeesSection.tsx'
export type { EmployeeDockInjected, EmployeeDockProps } from './EmployeeDock.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Employees settings page and live dock copy. */
    employees: EmployeesKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'employees'

/** Required services for settings scopes, locale, and slot registration. */
export const inject = ['slots', 'locale', 'settingsScope', 'connection', 'remote', 'sessions']

/**
 * Register the Employees settings page and the live employee dock.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-botforge: dictionaries')
  const t = ctx.locale.bind(NS)
  const workersScope = ctx.settingsScope.bind<EmployeesSectionValue>({ namespace: WORKERS_NS })
  const orchScope = ctx.settingsScope.bind<OrchestratorSectionValue>({ namespace: ORCH_NS })

  const sectionInjected = (): EmployeesSectionInjected => ({
    hooks: { workers: workersScope, orch: orchScope },
    setWorkers: (workers) => workersScope.set('workers', workers),
    setOrch: (field, value) => orchScope.set(field, value),
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'employees',
    order: 22,
    locale: NS,
    label: () => t('nav'),
    inject: sectionInjected,
  }, EmployeesSection))

  const dockInjected = (): EmployeeDockInjected => ({
    hooks: { workers: workersScope, orch: orchScope },
    openChild: (address) => { ctx.sessions.openSubagent(address) },
    setCatalogOpen: (parentSessionId: SessionId, open: boolean) => {
      ctx.sessions.setSubagentCatalogOpen(parentSessionId, open)
    },
    refresh: (parentSessionId: SessionId) => {
      void ctx.sessions.refreshSubagents(parentSessionId)
    },
  })

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'employees',
    order: 20,
    locale: NS,
    inject: dockInjected,
  }, EmployeeDock))
}
