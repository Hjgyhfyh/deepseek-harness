/**
 * Host-owned continuation prompt admitted when a client asks to resume an
 * idle agent without typing a new user bubble, and the same notice the
 * gateway steers when a live step ends `max-tokens`.
 * @module dsh-host-apiproxy/agent-continue
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'

/** Durable plugin id on the notice `user/message` (collapsed context row). */
export const AGENT_CONTINUE_PLUGIN = 'agent-continue'

/**
 * Model-facing continuation text. Pinned verbatim: the model must resume the
 * unfinished reply without restarting completed work or repeating delivered
 * output, and the string must not name UI, transport, or Host vocabulary.
 */
export const AGENT_CONTINUE_PROMPT = [
  'Continue from where the previous reply stopped.',
  'Resume unfinished work; do not restart completed steps or repeat already delivered output.',
].join(' ')

/** Collapsed-row account for the plugin-sourced notice. */
export const AGENT_CONTINUE_SUMMARY = 'Continue'

/**
 * Build the plugin-sourced follow-up the Host admits for a Continue gesture.
 * @returns an immutable user-role notice whose content is {@link AGENT_CONTINUE_PROMPT}.
 */
export function createAgentContinueMessage(): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text: AGENT_CONTINUE_PROMPT }],
    source: {
      kind: 'plugin',
      plugin: AGENT_CONTINUE_PLUGIN,
      form: 'notice',
      summary: boundContextSummary(AGENT_CONTINUE_SUMMARY),
    },
  })
}

/**
 * Whether the open turn's latest model finish is `max-tokens`.
 * @param agent - the agent whose open-turn log is inspected.
 * @returns true only when that latest finish is `max-tokens`.
 */
export function openTurnLastFinishIsMaxTokens(agent: Agent): boolean {
  const { events } = agent.session
  const turnStart = events.findLastIndex(event => event.type === 'turn/start')
  const openTurn = turnStart < 0 ? events : events.slice(turnStart)
  const finish = openTurn.findLast(event =>
    event.type === 'assistant/chunk' && event.data.chunk.type === 'finish')
  return finish?.type === 'assistant/chunk'
    && finish.data.chunk.type === 'finish'
    && finish.data.chunk.reason.kind === 'max-tokens'
}

/**
 * Steer {@link createAgentContinueMessage} at `agent/turn-stopping` when the
 * latest finish is `max-tokens` and nothing else already queued the next step.
 * Cooperates with `signal`; does not continue abort, error, or a completed last step.
 * @param ctx - the host context that receives every agent's turn-stopping serial.
 */
export function installMaxTokensAutoContinue(ctx: Context): void {
  ctx.on('agent/turn-stopping', ({ agent, signal }) => {
    if (signal.aborted) return
    if (agent.inbox.nextStep.length > 0) return
    if (!openTurnLastFinishIsMaxTokens(agent)) return
    agent.steer(createAgentContinueMessage())
  })
}
