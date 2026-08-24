/**
 * The globally named `send_message` and `interrupt_agent` tools: thin
 * model-facing adapters over `ctx.subagents.followup()` and
 * `ctx.subagents.interrupt()`. They perform no lifecycle routing of their own —
 * residency, cold resume, and interrupt authorization belong to the subagent
 * service — and they live apart from the provider-bound
 * `@deepseek-ai/dsh-tool-subagent` instances so multiple delegation tools share
 * one control API.
 * @module @deepseek-ai/dsh-tool-subagent-control
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-agent'

export const name = 'tool-subagent-control'
export const inject = ['tools', 'subagents', 'agents']

/** How long deliver:"now" waits for the interrupted turn to settle before degrading to the queued path. */
const NOW_SETTLE_TIMEOUT_MS = 10_000

/**
 * Register the `send_message` and `interrupt_agent` tools.
 * @param ctx - context carrying the tool registry and subagent service.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'send_message',
    description:
      'Send a message to a background subagent by its subagent id, continuing the same conversation. '
      + 'By default it becomes the subagent\'s next turn: if it is still working, the message waits until its '
      + 'current turn finishes. With deliver "now" the subagent\'s current turn is interrupted first and your '
      + 'message runs immediately, so you can redirect work already underway without waiting for completion. '
      + 'This call returns no answer from the subagent — only confirmation that the message was delivered — so '
      + 'use it to give it more work. A failure means the message was NOT delivered.',
    parameters: {
      subagent_id: {
        type: 'string',
        required: true,
        description: 'The subagent id returned when the background subagent was started.',
      },
      message: {
        type: 'string',
        required: true,
        description: 'The message to deliver to the subagent.',
      },
      deliver: {
        type: 'string',
        enum: ['queued', 'now'],
        description:
          'Delivery mode. "queued" (default) parks the message as the subagent\'s next turn after its current '
          + 'turn finishes. "now" interrupts the running turn and delivers immediately.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          messageId: { type: 'string', required: true },
          delivered: { type: 'string', enum: ['queued', 'now'], required: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: value.delivered === 'now'
          ? `delivered immediately (running turn interrupted) to subagent ${args.subagent_id}`
          : `message queued as the next turn for subagent ${args.subagent_id}`,
      }],
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (!parent) {
        // Parent authority requires an exact live calling agent.
        throw new Error('send_message requires a calling agent (exec.agent was undefined)')
      }
      let delivered: 'queued' | 'now' = args.deliver === 'now' ? 'now' : 'queued'
      if (delivered === 'now') {
        // Immediate delivery: stop the in-flight turn (inbox preserved), let
        // the driver settle (bounded — a stuck child degrades to the queued
        // path), then admit the message as a waking turn. An idle or
        // already-finished target makes the interrupt a no-op and the
        // delivery keeps its ordinary cold-resume/wake semantics.
        ctx.subagents.interrupt(SessionId(args.subagent_id), { kind: 'ancestor', agent: parent })
        const target = ctx.agents.get(SessionId(args.subagent_id))
        if (target !== undefined) {
          // Bounded settle wait: whenIdle on success, the caller signal or the
          // timeout cap as the degradation paths (the message then parks like
          // any queued follow-up instead of blocking this tool).
          const settled = Promise.withResolvers<undefined>()
          const settle = (): void => { settled.resolve(undefined) }
          const timer = setTimeout(settle, NOW_SETTLE_TIMEOUT_MS)
          exec.signal.addEventListener('abort', settle, { once: true })
          try {
            await Promise.race([target.whenIdle().then(settle), settled.promise])
            delivered = target.status === 'idle' ? 'now' : 'queued'
          } finally {
            clearTimeout(timer)
            exec.signal.removeEventListener('abort', settle)
          }
        }
      }
      const message: ContentBlock[] = [{ type: 'text', text: args.message }]
      const messageId = await ctx.subagents.followup(
        parent,
        SessionId(args.subagent_id),
        message,
        {
          source: { kind: 'coordinator', form: 'relay', senderSessionId: parent.id },
          signal: exec.signal,
        },
      )
      return { messageId, delivered }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'interrupt_agent',
    description:
      'Request cancellation of a background agent\'s current turn by its agent id. The target may be your '
      + 'direct child or a deeper agent created under you. Only the current turn stops: messages already '
      + 'queued for the agent stay parked until a later send_message, agents it started keep running, and '
      + 'the agent itself stays available for follow-ups. This call returns as soon as the stop request is '
      + 'accepted, so the target may keep running briefly; interrupting an agent that already finished is '
      + 'an accepted no-op.',
    parameters: {
      agent_id: {
        type: 'string',
        required: true,
        description: 'The agent id of the running agent to interrupt.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          accepted: { type: 'boolean', required: true },
        },
      },
      render: (args, _value) => [{
        type: 'text',
        text: `interrupt requested for agent ${args.agent_id}`,
      }],
    },
    execute(args, exec) {
      const caller = exec.agent
      if (!caller) {
        // Ancestor authority requires an exact live calling agent.
        throw new Error('interrupt_agent requires a calling agent (exec.agent was undefined)')
      }
      // The service authorizes the exact live caller against the target's
      // recorded lineage; the tool adds no authority of its own.
      ctx.subagents.interrupt(SessionId(args.agent_id), { kind: 'ancestor', agent: caller })
      return Promise.resolve({ accepted: true })
    },
  }))
}
