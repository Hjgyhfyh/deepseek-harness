/**
 * BotForge host plugin: employee roster, orchestrator prompt, and the
 * `delegate_employee` tool. Configuration lives in the host settings document
 * (`botforge-workers`, `botforge-orchestrator`). The master `enabled` switch
 * drops the prompt section and the tool together. The orchestrator section is
 * omitted when assembling for a delegated child. Each employee child receives
 * a specialist persona, a child-scoped deny list of spawn tools (including
 * preset `subagent_*` names), and a guard that refuses those names, so it
 * cannot spawn nested employees or subagents.
 *
 * @module @deepseek-ai/dsh-botforge
 */
import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-agent'
import { routeWorkers, buildEnrichedPrompt } from './workers/router.ts'
import type { WorkerKind } from './workers/definitions.ts'
import {
  DEFAULT_ORCHESTRATOR_PROMPT,
  ORCH_NS,
  OrchestratorSectionSchema,
  WORKERS_NS,
  WorkersSectionSchema,
  defaultOrchestrator,
  defaultWorkers,
  normalizeWorker,
  parseEmployeeId,
  validateWorkersSection,
  type BotForgeOrchestratorSection,
  type BotForgeWorkerConfig,
  type BotForgeWorkersSection,
} from './config.ts'
import { buildOrchestratorSection } from './prompt.ts'
import { registerEmployeeTool } from './tool.ts'
import { creationLabelOf, isDelegationTool, isEmployeeChild, lockEmployeeDelegation } from './delegation-lock.ts'
import { installEmployeeExtras } from './extras.ts'

export const name = 'botforge'
export const inject: readonly string[] = []

export type { WorkerKind, WorkerDef } from './workers/definitions.ts'
export { WORKERS, byId } from './workers/definitions.ts'
export { routeWorkers, buildEnrichedPrompt } from './workers/router.ts'
export type { RouteResult } from './workers/router.ts'
export {
  DEFAULT_ORCHESTRATOR_PROMPT,
  EMPLOYEE_LABEL_PREFIX,
  EMPLOYEE_PROVIDER,
  EMPLOYEE_TOOL_NAME,
  ORCH_NS,
  WORKERS_NS,
  defaultOrchestrator,
  defaultWorkers,
  employeeLabel,
  matchEmployee,
  parseEmployeeId,
  type BotForgeMcpServer,
  type BotForgeOrchestratorSection,
  type BotForgeWorkerConfig,
  type BotForgeWorkersSection,
} from './config.ts'

/** Live roster and orchestrator, replaced when settings commit. */
const live: {
  workers: BotForgeWorkerConfig[]
  orch: BotForgeOrchestratorSection
} = {
  workers: defaultWorkers(),
  orch: defaultOrchestrator(),
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    botforge: BotForgeService
  }
  interface Events {
    /**
     * Emitted when BotForge routes a task (host + client both may listen).
     * @param payload - routed task identity and the employee ids chosen for it.
     * @mode emit
     */
    'botforge/routed'(payload: {
      taskId: string
      text: string
      ids: readonly string[]
      fallback: boolean
      enriched: string
    }): void
    /**
     * Emitted after the employee roster or orchestrator settings are applied.
     * @mode emit
     */
    'botforge/config'(): void
  }
}

/** Current employee roster from host settings. */
export function currentWorkerConfigs(): readonly BotForgeWorkerConfig[] {
  return live.workers
}

/** Whether the employees plugin is on. */
export function pluginEnabled(): boolean {
  return live.orch.enabled
}

/** Host-facing roster and routing helpers. */
export class BotForgeService {
  /**
   * @param ctx - host context used to emit `botforge/config`.
   */
  constructor(private readonly ctx: Context) {}

  /**
   * Snapshot the roster for inspectors.
   * @returns a shallow copy of each employee row.
   */
  listWorkers() {
    return live.workers.map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role,
      roleDescription: w.roleDescription,
      skills: [...w.skills],
      hint: w.hint,
      avatar: w.avatar,
      enabled: w.enabled,
      mcp: [...w.mcp],
    }))
  }

  /**
   * Look up one employee by id.
   * @param id - roster id.
   * @returns the row, or `undefined`.
   */
  getWorker(id: string) {
    return live.workers.find((w) => w.id === id)
  }

  /**
   * Snapshot the orchestrator section, including the master switch.
   * @returns a shallow copy of the orchestrator settings.
   */
  orchestrator() {
    return { ...live.orch, mcp: [...live.orch.mcp] }
  }

  /**
   * Score a free-text task against built-in triggers.
   * @param text - user task text.
   * @returns the local router result.
   */
  route(text: string) {
    return routeWorkers(text)
  }

  /**
   * Build an enriched prompt that also lists live skills, prompts, and MCP.
   * @param text - original task.
   * @param ids - employee ids to include.
   * @param fallback - whether the router used fallback scoring.
   * @returns enriched text plus suggested subtasks.
   */
  enrich(text: string, ids: readonly WorkerKind[], fallback: boolean) {
    const payload = buildEnrichedPrompt(text, ids, fallback)
    const lines = payload.enriched.split('\n')
    const cfgLines: string[] = ['']
    for (const w of live.workers.filter((x) => x.enabled && ids.includes(x.id as WorkerKind))) {
      cfgLines.push(`Работник ${w.name} (${w.id}):`)
      cfgLines.push(`  скиллы: ${w.skills.join(', ') || '—'}`)
      if (w.systemPrompt.trim()) cfgLines.push(`  системный промпт: ${w.systemPrompt.trim()}`)
      if (w.mcp.length) {
        cfgLines.push(`  MCP: ${w.mcp.map((m) => `${m.name} (${m.command || m.url || '—'})`).join(', ')}`)
      }
    }
    return { enriched: [...lines, ...cfgLines].join('\n'), subtasks: payload.subtasks }
  }

  /** Notify listeners that the live roster changed. */
  notifyConfig(): void {
    this.ctx.emit('botforge/config')
  }
}

function applyRoster(section: BotForgeWorkersSection | undefined): void {
  if (Array.isArray(section?.workers) && section.workers.length > 0) {
    live.workers = section.workers.map(normalizeWorker)
  } else {
    live.workers = defaultWorkers()
  }
}

function applyOrchestrator(section: BotForgeOrchestratorSection | undefined): void {
  live.orch = {
    enabled: section?.enabled !== false,
    name: section?.name || 'Оркестратор',
    systemPrompt: section?.systemPrompt || DEFAULT_ORCHESTRATOR_PROMPT,
    mcp: section?.mcp ?? [],
  }
}

/**
 * Mount the BotForge service, settings, prompt section, and employee tool.
 * @param ctx - host context.
 */
export function apply(ctx: Context): void {
  live.workers = defaultWorkers()
  live.orch = defaultOrchestrator()
  const service = new BotForgeService(ctx)
  ctx.provide('botforge', service)

  ctx.on('botforge/routed', ({ taskId, text, ids, enriched }) => {
    ctx.logger.info(
      `botforge routed ${taskId} → ${ids.join(',')}: ${text.slice(0, 80)} (${enriched.length} chars enriched)`,
    )
  })

  ctx.inject(['settings'], (sctx) => {
    const workersNs = settingsNamespace(WORKERS_NS)
    const orchNs = settingsNamespace(ORCH_NS)
    const workersScope = sctx.settings.register<BotForgeWorkersSection>(workersNs, WorkersSectionSchema as never, {
      base: { workers: live.workers },
      applies: 'live',
      validate: validateWorkersSection,
    })
    const orchScope = sctx.settings.register<BotForgeOrchestratorSection>(orchNs, OrchestratorSectionSchema as never, {
      base: live.orch,
      applies: 'live',
    })

    const sync = (): void => {
      applyRoster(workersScope.get())
      applyOrchestrator(orchScope.get())
      service.notifyConfig()
    }
    sync()
    workersScope.watch(() => { sync() })
    orchScope.watch(() => { sync() })
  })

  ctx.inject(['systemPrompt'], (spctx) => {
    spctx.effect(() => spctx.systemPrompt.section({
      name: 'botforge:workers',
      order: 12,
      text: (context) => buildOrchestratorSection(
        live.orch.enabled,
        live.orch,
        live.workers,
        context.agent?.session.header,
      ),
    }), 'botforge: system section')
  })

  ctx.inject(['tools', 'subagents'], (tctx) => {
    tctx.tools.guard((execution) => {
      const agent = execution.agent
      if (agent === undefined || !isEmployeeChild(agent) || !isDelegationTool(execution.name)) {
        return undefined
      }
      return 'employees cannot spawn or steer other agents'
    })
    tctx.subagents.registerContinuableSetup((childCtx) => {
      const agent = childCtx.agent
      if (agent === undefined || !isEmployeeChild(agent) || childCtx.get('tools') === undefined) {
        return () => undefined
      }
      const worker = live.workers.find((w) => w.id === parseEmployeeId(creationLabelOf(agent) ?? ''))
      if (worker === undefined) {
        childCtx.logger.warn?.('botforge: employee child matched but no roster row; MCP and skills skipped')
        return lockEmployeeDelegation(childCtx.tools, agent)
      }
      void installEmployeeExtras(childCtx, worker, agent.session.header.cwd, new AbortController().signal)
        .catch((error: unknown) => {
          childCtx.logger.warn?.(`botforge: employee extras failed to install: ${String(error)}`)
        })
      return lockEmployeeDelegation(childCtx.tools, agent)
    })
    let disposeTool: (() => void) | undefined
    const remount = (): void => {
      disposeTool?.()
      disposeTool = undefined
      if (!live.orch.enabled) return
      disposeTool = registerEmployeeTool(tctx, {
        enabled: () => live.orch.enabled,
        getWorker: (id) => live.workers.find((w) => w.id === id),
      })
    }
    remount()
    tctx.on('botforge/config', remount)
    tctx.effect(() => () => {
      disposeTool?.()
      disposeTool = undefined
    }, 'botforge: employee tool')
  })
}
