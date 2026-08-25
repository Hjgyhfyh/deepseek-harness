/**
 * Host-owned continuation prompt admitted when a client asks to resume an
 * idle agent without typing a new user bubble.
 * @module dsh-host-apiproxy/agent-continue
 */

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
