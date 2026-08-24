/**
 * Employees settings page: master plugin switch, orchestrator persona, and
 * per-employee system prompt / skills / MCP.
 */

import { useEffect, useMemo, useState } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { Button, IconPlusOutline16, IconTrashOutline16, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { EmployeeAvatar } from './EmployeeAvatar.tsx'
import {
  defaultEmployees,
  defaultOrchestrator,
  nextEmployeeId,
  normalizeEmployee,
  normalizeMcp,
  parseArgs,
  parseSkills,
  type EmployeeConfig,
  type EmployeeMcpServer,
  type EmployeesSectionValue,
  type OrchestratorSectionValue,
} from './employees.ts'
import type { EmployeesKey } from './locales.ts'
import css from './EmployeesSection.module.css'

/** Registration-side business face for the Employees settings section. */
export interface EmployeesSectionInjected {
  hooks: {
    /** Host `botforge-workers` namespace. */
    workers: SettingsScope<EmployeesSectionValue>
    /** Host `botforge-orchestrator` namespace. */
    orch: SettingsScope<OrchestratorSectionValue>
  }
  /**
   * Replace the employee roster field.
   * @param workers - next roster.
   */
  setWorkers: (workers: readonly EmployeeConfig[]) => Promise<void>
  /**
   * Write one orchestrator field.
   * @param field - top-level orchestrator field name.
   * @param value - JSON-shaped value.
   */
  setOrch: (field: string, value: unknown) => Promise<void>
}

/** Props the renderer binds for the section. */
export type EmployeesSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'employees'>
  & InjectFace<EmployeesSectionInjected>

function emptyMcp(): EmployeeMcpServer {
  return normalizeMcp({})
}

function emptyEmployee(id: string): EmployeeConfig {
  return normalizeEmployee({
    id,
    enabled: true,
    name: id,
    role: '',
    roleDescription: '',
    skills: [],
    hint: '',
    triggers: [],
    systemPrompt: '',
    avatar: '',
    avatarSeed: id,
    mcp: [],
  })
}

/**
 * Render the Employees settings page.
 * @param props - locale copy and bound settings-scope selector hooks.
 * @returns the section.
 */
export function EmployeesSection(props: EmployeesSectionProps): React.ReactNode {
  const { t, useWorkers, useOrch, setWorkers, setOrch } = props
  const workersSnap = useWorkers((snapshot) => snapshot)
  const orchSnap = useOrch((snapshot) => snapshot)
  const workers = workersSnap.value?.workers ?? []
  const orch = orchSnap.value ?? defaultOrchestrator()
  const writable = workersSnap.writable && orchSnap.writable
  const [selectedId, setSelectedId] = useState<string | undefined>(workers[0]?.id)
  const [draft, setDraft] = useState<EmployeeConfig | undefined>()
  const [orchName, setOrchName] = useState(orch.name)
  const [orchPrompt, setOrchPrompt] = useState(orch.systemPrompt)
  const [orchMcp, setOrchMcp] = useState<EmployeeMcpServer[]>(orch.mcp.map(normalizeMcp))

  useEffect(() => {
    const next = orchSnap.value
    if (next === undefined) return
    setOrchName(next.name)
    setOrchPrompt(next.systemPrompt)
    setOrchMcp(next.mcp.map(normalizeMcp))
  }, [orchSnap.value])

  const selected = useMemo(
    () => workers.find((row) => row.id === selectedId) ?? workers[0],
    [workers, selectedId],
  )

  useEffect(() => {
    if (selected === undefined) {
      setDraft(undefined)
      return
    }
    setDraft(normalizeEmployee(selected))
  }, [selected])

  if (workersSnap.status === 'loading' || orchSnap.status === 'loading') {
    return <p className={css.intro}>{t('loading' satisfies EmployeesKey)}</p>
  }
  if (workersSnap.status === 'unavailable' || orchSnap.status === 'unavailable') {
    return <p className={css.intro}>{t('unavailable')}</p>
  }

  return (
    <section className={css.section}>
      <h2 className={css.heading}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      {writable ? null : <p className={css.intro}>{t('readOnly')}</p>}

      <label className={css.toggle}>
        <input
          type="checkbox"
          checked={orch.enabled}
          disabled={!writable}
          onChange={(event) => { void setOrch('enabled', event.target.checked) }}
        />
        <span>
          <strong>{t('enabled')}</strong>
          <span className={css.hint}>{t('enabledHint')}</span>
        </span>
      </label>

      <h3 className={css.subhead}>{t('orchTitle')}</h3>
      <label className={css.field}>
        <span>{t('orchName')}</span>
        <Input
          value={orchName}
          disabled={!writable}
          onChange={(event) => { setOrchName(event.target.value) }}
        />
      </label>
      <label className={css.field}>
        <span>{t('orchPrompt')}</span>
        <textarea
          className={css.textarea}
          value={orchPrompt}
          disabled={!writable}
          rows={8}
          onChange={(event) => { setOrchPrompt(event.target.value) }}
        />
      </label>
      <McpEditor
        t={t}
        title={t('orchMcp')}
        rows={orchMcp}
        disabled={!writable}
        onChange={setOrchMcp}
      />
      <Button
        variant="primary"
        disabled={!writable}
        onClick={() => {
          void setOrch('name', orchName)
          void setOrch('systemPrompt', orchPrompt)
          void setOrch('mcp', orchMcp)
        }}
      >
        {t('save')}
      </Button>

      <h3 className={css.subhead}>{t('rosterTitle')}</h3>
      <div className={css.toolbar}>
        <Button
          variant="outline"
          icon={<IconPlusOutline16 />}
          disabled={!writable}
          onClick={() => {
            const id = nextEmployeeId(workers.map((row) => row.id))
            const next = [...workers, emptyEmployee(id)]
            void setWorkers(next)
            setSelectedId(id)
          }}
        >
          {t('addEmployee')}
        </Button>
        <Button
          variant="ghost"
          disabled={!writable}
          onClick={() => {
            const next = defaultEmployees()
            void setWorkers(next)
            setSelectedId(next[0]?.id)
          }}
        >
          {t('restoreDefaults')}
        </Button>
      </div>

      {workers.length === 0
        ? <p className={css.intro}>{t('emptyRoster')}</p>
        : (
          <ul className={css.roster}>
            {workers.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={row.id === selected?.id ? css.rosterActive : css.rosterItem}
                  onClick={() => { setSelectedId(row.id) }}
                >
                  <EmployeeAvatar name={row.name} seed={row.avatarSeed} size={28} />
                  <span>
                    <strong>{row.name}</strong>
                    <span className={css.hint}>{row.id}{row.enabled ? '' : ' · off'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

      {draft === undefined
        ? null
        : (
          <EmployeeEditor
            t={t}
            draft={draft}
            writable={writable}
            onChange={setDraft}
            onSave={() => {
              const next = workers.some((row) => row.id === draft.id)
                ? workers.map((row) => row.id === draft.id ? draft : row)
                : [...workers, draft]
              void setWorkers(next)
              setSelectedId(draft.id)
            }}
            onDelete={() => {
              const next = workers.filter((row) => row.id !== draft.id)
              void setWorkers(next)
              setSelectedId(next[0]?.id)
            }}
          />
        )}
    </section>
  )
}

function EmployeeEditor(props: {
  t: EmployeesSectionProps['t']
  draft: EmployeeConfig
  writable: boolean
  onChange: (next: EmployeeConfig) => void
  onSave: () => void
  onDelete: () => void
}): React.ReactNode {
  const { t, draft, writable, onChange } = props
  const patch = (partial: Partial<EmployeeConfig>): void => {
    onChange(normalizeEmployee({
      ...draft,
      ...partial,
      id: partial.id ?? draft.id,
      ...partial.role !== undefined ? { roleDescription: partial.role } : {},
    }))
  }
  return (
    <div className={css.editor}>
      <label className={css.toggle}>
        <input
          type="checkbox"
          checked={draft.enabled}
          disabled={!writable}
          onChange={(event) => { patch({ enabled: event.target.checked }) }}
        />
        <span>{t('employeeEnabled')}</span>
      </label>
      <label className={css.field}>
        <span>{t('fieldId')}</span>
        <Input value={draft.id} disabled={!writable} onChange={(event) => { patch({ id: event.target.value }) }} />
      </label>
      <label className={css.field}>
        <span>{t('fieldName')}</span>
        <Input value={draft.name} disabled={!writable} onChange={(event) => { patch({ name: event.target.value }) }} />
      </label>
      <label className={css.field}>
        <span>{t('fieldRole')}</span>
        <Input value={draft.role} disabled={!writable} onChange={(event) => { patch({ role: event.target.value }) }} />
      </label>
      <label className={css.field}>
        <span>{t('fieldHint')}</span>
        <Input value={draft.hint} disabled={!writable} onChange={(event) => { patch({ hint: event.target.value }) }} />
      </label>
      <label className={css.field}>
        <span>{t('fieldPrompt')}</span>
        <textarea
          className={css.textarea}
          value={draft.systemPrompt}
          disabled={!writable}
          rows={8}
          onChange={(event) => { patch({ systemPrompt: event.target.value }) }}
        />
      </label>
      <label className={css.field}>
        <span>{t('fieldSkills')}</span>
        <Input
          value={draft.skills.join(', ')}
          disabled={!writable}
          aria-label={t('fieldSkills')}
          title={t('fieldSkillsHint')}
          onChange={(event) => { patch({ skills: parseSkills(event.target.value) }) }}
        />
        <span className={css.hint}>{t('fieldSkillsHint')}</span>
      </label>
      <McpEditor
        t={t}
        title={t('fieldMcp')}
        rows={[...draft.mcp]}
        disabled={!writable}
        onChange={(mcp) => { patch({ mcp }) }}
      />
      <div className={css.toolbar}>
        <Button variant="primary" disabled={!writable} onClick={props.onSave}>{t('save')}</Button>
        <Button
          variant="ghost"
          icon={<IconTrashOutline16 />}
          disabled={!writable}
          onClick={props.onDelete}
        >
          {t('deleteEmployee')}
        </Button>
      </div>
    </div>
  )
}

function McpEditor(props: {
  t: EmployeesSectionProps['t']
  title: string
  rows: EmployeeMcpServer[]
  disabled: boolean
  onChange: (next: EmployeeMcpServer[]) => void
}): React.ReactNode {
  const { t, disabled, onChange } = props
  const rows = props.rows.map((row) => normalizeMcp(row))
  const patchAt = (index: number, partial: Partial<EmployeeMcpServer>): void => {
    onChange(rows.map((row, i) => i === index ? normalizeMcp({ ...row, ...partial }) : row))
  }
  return (
    <div className={css.mcp}>
      <div className={css.toolbar}>
        <strong>{props.title}</strong>
        <Button
          variant="ghost"
          icon={<IconPlusOutline16 />}
          disabled={disabled}
          onClick={() => { onChange([...rows, emptyMcp()]) }}
        >
          {t('addMcp')}
        </Button>
      </div>
      {rows.map((row, index) => (
        <div key={`${row.name}-${String(index)}`} className={css.mcpRow}>
          <Input
            value={row.name}
            disabled={disabled}
            aria-label={`${props.title} ${t('mcpName')}`}
            placeholder={t('mcpName')}
            onChange={(event) => { patchAt(index, { name: event.target.value }) }}
          />
          <Input
            value={row.command}
            disabled={disabled}
            aria-label={`${props.title} ${t('mcpCommand')}`}
            placeholder={t('mcpCommand')}
            onChange={(event) => { patchAt(index, { command: event.target.value }) }}
          />
          <Input
            value={row.args.join(' ')}
            disabled={disabled}
            aria-label={`${props.title} ${t('mcpArgs')}`}
            placeholder={t('mcpArgs')}
            onChange={(event) => { patchAt(index, { args: parseArgs(event.target.value) }) }}
          />
          <Input
            value={row.url}
            disabled={disabled}
            aria-label={`${props.title} ${t('mcpUrl')}`}
            placeholder={t('mcpUrl')}
            onChange={(event) => { patchAt(index, { url: event.target.value }) }}
          />
          <Input
            value={row.cwd}
            disabled={disabled}
            aria-label={`${props.title} ${t('mcpCwd')}`}
            placeholder={t('mcpCwd')}
            onChange={(event) => { patchAt(index, { cwd: event.target.value }) }}
          />
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() => { onChange(rows.filter((_, i) => i !== index)) }}
          >
            {t('removeMcp')}
          </Button>
        </div>
      ))}
    </div>
  )
}
