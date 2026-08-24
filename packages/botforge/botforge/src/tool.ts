/**
 * Model-facing `delegate_employee` tool: start one configured employee as a
 * child agent with that employee's specialist persona, skills, and MCP.
 * The child does not inherit orchestrator identity or delegation tools.
 * @module @deepseek-ai/dsh-botforge/tool
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { SessionId, type JsonValue } from '@deepseek-ai/dsh-session'
import {
  EMPLOYEE_PROVIDER,
  EMPLOYEE_TOOL_NAME,
  employeeLabel,
  isDelegatedSession,
  type BotForgeWorkerConfig,
} from './config.ts'
import { employeeToolFilter } from './delegation-lock.ts'
import { installEmployeeExtras, loadEmployeeSkillBodies } from './extras.ts'
import { buildEmployeePersona } from './prompt.ts'

/** Live roster + master switch read on each call. */
export interface EmployeeToolState {
  /** When false, every call is rejected. */
  enabled: () => boolean
  /** Look up one employee by id. */
  getWorker: (id: string) => BotForgeWorkerConfig | undefined
}

/**
 * Render text blocks from a canonical JSON block array.
 * @param values - tool output blocks.
 * @returns concatenated text.
 */
function outputValueText(values: JsonValue[]): string {
  return values
    .filter((value): value is { type: 'text'; text: string } =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
      && value.type === 'text' && typeof value.text === 'string')
    .map((value) => value.text)
    .join('')
}

/**
 * Register `delegate_employee` on the current tools registry.
 * @param ctx - context that already has `tools` and `subagents`.
 * @param state - live plugin switch and roster.
 * @returns the tool registration disposer.
 */
export function registerEmployeeTool(ctx: Context, state: EmployeeToolState): () => void {
  return ctx.tools.register(defineTool({
    name: EMPLOYEE_TOOL_NAME,
    description:
      'Delegate a self-contained task to one configured employee (a child agent with that '
      + 'employee\'s system prompt, skills, and MCP servers). Every call opens a NEW conversation '
      + 'with that employee — keep one task per chat: for a new task start a new chat instead of '
      + 'sending everything into one, and use send_message with the returned id only to add work '
      + 'to this same task\'s chat. Use this instead of subagent when the work belongs to a named '
      + 'employee from the roster. The call runs in the background by default and returns a durable '
      + 'child id. Set run_in_background false only when the next action depends on that employee\'s '
      + 'result. After starting an employee in the background, END YOUR TURN immediately: you will '
      + 'be notified when it finishes. Do not poll list_agents in a loop, do not spawn duplicate '
      + 'employees for the same task, and never do the delegated work yourself while waiting.',
    parameters: {
      employee_id: {
        type: 'string',
        required: true,
        description: 'Id of an enabled employee from the roster (for example roblox, web, telegram).',
      },
      description: {
        type: 'string',
        required: true,
        description: 'A short (3-5 word) description of the delegated task, for display.',
      },
      prompt: {
        type: 'string',
        required: true,
        description:
          'The complete, self-contained task for the employee. It does not share this conversation\'s '
          + 'context, so include everything it needs.',
      },
      run_in_background: {
        type: 'boolean',
        description:
          'Whether to run in the background and return a durable employee id immediately. Defaults to true.',
      },
    },
    output: {
      schema: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true, const: 'continuable' },
              subagentId: { type: 'string', required: true },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true, const: 'foreground' },
              runId: { type: 'string', required: true },
              output: { type: 'array', required: true, items: { type: 'json' } },
            },
          },
        ],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.kind === 'continuable'
          ? `started employee ${value.subagentId}`
          : outputValueText(value.output),
      }],
    },
    presentCall: (args) => ({
      card: 'generic',
      title: args.description,
      kind: 'other',
      rawInput: args.employee_id,
    }),
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (!state.enabled()) {
        throw new Error('employees plugin is disabled')
      }
      const parent = exec.agent
      if (!parent) {
        throw new Error('delegate_employee requires a calling agent (exec.agent was undefined)')
      }
      if (isDelegatedSession(parent.session.header)) {
        throw new Error('delegate_employee is only available to the orchestrator')
      }
      const worker = state.getWorker(args.employee_id)
      if (worker === undefined) {
        throw new Error(`unknown employee id "${args.employee_id}"`)
      }
      if (!worker.enabled) {
        throw new Error(`employee "${args.employee_id}" is disabled`)
      }
      const subagents = ctx.get('subagents')
      if (subagents === undefined) {
        throw new Error('subagent service is not available')
      }
      const provider = subagents.getProvider(EMPLOYEE_PROVIDER)
      if (provider === undefined) {
        throw new Error(`subagent provider "${EMPLOYEE_PROVIDER}" is not registered`)
      }
      const skillBodies = await loadEmployeeSkillBodies(
        ctx,
        worker,
        parent.session.header.cwd,
        exec.signal,
      )
      const personaText = buildEmployeePersona(worker, skillBodies)
      const promptText = args.prompt
      const label = employeeLabel(worker.id, args.description)
      const persona = provider.capabilities.persona ? personaText : undefined
      const toolFilter = employeeToolFilter(ctx.tools, parent)
      const request = {
        label,
        prompt: [{ type: 'text' as const, text: persona === undefined
          ? `${personaText}\n\n${promptText}`
          : promptText }] as ContentBlock[],
        parent,
        ...persona !== undefined ? { persona } : {},
        ...toolFilter !== undefined ? { toolFilter } : {},
      }
      const background = args.run_in_background !== false
      if (background) {
        const started = await subagents.startContinuable({
          provider: EMPLOYEE_PROVIDER,
          label,
          request,
          signal: exec.signal,
        })
        await attachExtras(ctx, started.childId, worker, parent, exec.signal)
        ctx.emit('botforge/routed', {
          taskId: started.childId,
          text: args.prompt,
          ids: [worker.id],
          fallback: false,
          enriched: promptText,
        })
        return { kind: 'continuable' as const, subagentId: started.childId }
      }
      const run = await subagents.start(EMPLOYEE_PROVIDER, { ...request, signal: exec.signal })
      if (run.localAgent !== undefined) {
        await installEmployeeExtras(
          run.localAgent.ctx,
          worker,
          parent.session.header.cwd,
          exec.signal,
        )
      }
      const result = await run.result
      await run.dispose()
      if (result.stopReason !== 'completed') {
        throw new Error(`employee run ended (${result.stopReason})`)
      }
      return {
        kind: 'foreground' as const,
        runId: run.id,
        output: result.output as unknown as JsonValue[],
      }
    },
  }))
}

/**
 * Install extras on a continuable child once it is published.
 * @param ctx - parent context used to resolve the child agent.
 * @param childId - published child session id.
 * @param worker - employee configuration.
 * @param parent - delegating agent, for cwd.
 * @param signal - cancels skill loading.
 */
async function attachExtras(
  ctx: Context,
  childId: string,
  worker: BotForgeWorkerConfig,
  parent: Agent,
  signal: AbortSignal,
): Promise<void> {
  const agents = ctx.get('agents') as { get?: (id: ReturnType<typeof SessionId>) => { ctx: Context } | undefined } | undefined
  const child = agents?.get?.(SessionId(childId))
  if (child === undefined) {
    // A silent miss here would leave the employee running with no MCP and no
    // trace; the continuable-setup window already covers healthy creations,
    // so this path means an unexpected lookup failure.
    const logger = (parent.ctx ?? ctx).logger as { warn?: (m: string) => void }
    logger.warn?.(
      `botforge: could not resolve published employee child "${childId}"; `
      + `MCP servers for "${worker.id}" were not attached post-publication`,
    )
    return
  }
  await installEmployeeExtras(child.ctx, worker, parent.session.header.cwd, signal)
}
