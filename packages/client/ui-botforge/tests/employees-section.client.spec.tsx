// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { EmployeesSection } from '../src/client/EmployeesSection.tsx'
import type { EmployeesSectionProps } from '../src/client/EmployeesSection.tsx'
import { defaultEmployees, defaultOrchestrator } from '../src/client/employees.ts'
import { zh } from '../src/client/locales.ts'

const t: EmployeesSectionProps['t'] = makeTranslate(zh, commonZh)

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

function renderSection(
  workersOver: Partial<SettingsScopeSnapshot<{ workers: ReturnType<typeof defaultEmployees> }>> = {},
  orchOver: Partial<SettingsScopeSnapshot<ReturnType<typeof defaultOrchestrator>>> = {},
) {
  const setWorkers = vi.fn(async () => undefined)
  const setOrch = vi.fn(async () => undefined)
  const workersSnap = snap({ workers: defaultEmployees() }, workersOver)
  const orchSnap = snap(defaultOrchestrator(), orchOver)
  const props = {
    t,
    close: () => undefined,
    useWorkers: ((select: (value: typeof workersSnap) => unknown) => select(workersSnap)),
    useOrch: ((select: (value: typeof orchSnap) => unknown) => select(orchSnap)),
    setWorkers,
    setOrch,
    useSessions: () => undefined,
    useWorkspaces: () => undefined,
  } as unknown as EmployeesSectionProps
  return { ...render(<EmployeesSection {...props} />), setWorkers, setOrch }
}

describe('EmployeesSection', () => {
  it('shows loading and unavailable copy', () => {
    renderSection({ status: 'loading', value: undefined })
    expect(screen.getByText('正在加载员工设置…')).toBeTruthy()
    cleanup()
    renderSection({}, { status: 'unavailable', value: undefined, writable: false })
    expect(screen.getByText('当前连接不提供员工设置。')).toBeTruthy()
  })

  it('toggles the plugin, saves orchestrator fields, and restores defaults', () => {
    const { setOrch, setWorkers } = renderSection()
    expect(screen.getByText('员工')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /启用员工插件/ }))
    expect(setOrch).toHaveBeenCalledWith('enabled', false)

    fireEvent.change(screen.getByDisplayValue('Оркестратор'), { target: { value: 'Lead' } })
    fireEvent.change(screen.getByDisplayValue(/Ты — главный оркестратор/), { target: { value: 'Lead the team.' } })
    fireEvent.click(screen.getAllByRole('button', { name: '添加 MCP' })[0]!)
    fireEvent.click(screen.getAllByRole('button', { name: '添加 MCP' })[0]!)
    fireEvent.change(screen.getAllByLabelText('编排器 MCP 名称')[0]!, { target: { value: 'orch' } })
    fireEvent.click(screen.getAllByRole('button', { name: '保存' })[0]!)
    expect(setOrch).toHaveBeenCalledWith('name', 'Lead')
    expect(setOrch).toHaveBeenCalledWith('mcp', expect.any(Array))

    fireEvent.click(screen.getByRole('button', { name: '添加员工' }))
    expect(setWorkers).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '恢复默认名册' }))
    expect(setWorkers).toHaveBeenCalled()
  })

  it('adds, edits, saves, and deletes an employee, including MCP rows', () => {
    const { setWorkers } = renderSection({ value: { workers: [] } })
    expect(screen.getByText('还没有员工。添加一位，或恢复默认名册。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '添加员工' }))
    expect(setWorkers).toHaveBeenCalled()
    cleanup()

    const view = renderSection()
    fireEvent.click(screen.getByRole('button', { name: /Web Searcher/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: '启用此员工' }))
    fireEvent.change(screen.getByLabelText('员工名称'), { target: { value: 'Searcher' } })
    fireEvent.change(screen.getByLabelText('角色'), { target: { value: 'search' } })
    fireEvent.change(screen.getByLabelText('简介'), { target: { value: 'hint' } })
    fireEvent.change(screen.getByDisplayValue(/Ты — Web Searcher/), { target: { value: 'You search the web.' } })
    fireEvent.change(screen.getByLabelText('技能'), { target: { value: 'fetch, cheerio' } })
    fireEvent.click(screen.getAllByRole('button', { name: '添加 MCP' })[1]!)
    fireEvent.click(screen.getAllByRole('button', { name: '添加 MCP' })[1]!)
    fireEvent.change(screen.getAllByLabelText('MCP 服务器 名称')[0]!, { target: { value: 'docs' } })
    fireEvent.change(screen.getAllByPlaceholderText('命令')[0]!, { target: { value: 'npx' } })
    fireEvent.change(screen.getAllByPlaceholderText('参数')[0]!, { target: { value: '-y x' } })
    fireEvent.change(screen.getAllByPlaceholderText('URL')[0]!, { target: { value: 'http://x' } })
    fireEvent.change(screen.getAllByPlaceholderText('工作目录')[0]!, { target: { value: '/tmp' } })
    fireEvent.click(screen.getAllByRole('button', { name: /^删除$/ })[0]!)
    fireEvent.click(screen.getAllByRole('button', { name: '保存' })[1]!)
    expect(view.setWorkers).toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Id'), { target: { value: 'web-renamed' } })
    fireEvent.click(screen.getAllByRole('button', { name: '保存' })[1]!)
    fireEvent.click(screen.getByRole('button', { name: '删除员工' }))
    expect(view.setWorkers.mock.calls.length).toBeGreaterThan(1)
  })

  it('deletes the last employee and shows the read-only notice', () => {
    const one = defaultEmployees()[0]!
    const { setWorkers } = renderSection({ value: { workers: [one] } })
    fireEvent.click(screen.getByRole('button', { name: '删除员工' }))
    expect(setWorkers).toHaveBeenCalledWith([])
    cleanup()
    renderSection({ writable: false }, { writable: false })
    expect(screen.getByText('此部署以只读方式存储设置。')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /启用员工插件/ })).toHaveProperty('disabled', true)
  })

  it('marks a disabled employee in the roster and uses default orchestrator copy', () => {
    const one = { ...defaultEmployees()[0]!, enabled: false }
    renderSection({ value: { workers: [one] } })
    expect(screen.getByText(/roblox · off/)).toBeTruthy()
    cleanup()
    renderSection({}, { value: undefined, status: 'ready' })
    expect(screen.getByDisplayValue('Оркестратор')).toBeTruthy()
  })
})
