/**
 * Host continuation admission: `session.prompt` with `continuation: true`
 * followups a plugin-sourced notice instead of a user bubble.
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '../src/api-proxy.ts'
import {
  AGENT_CONTINUE_PLUGIN, AGENT_CONTINUE_PROMPT, AGENT_CONTINUE_SUMMARY,
} from '../src/agent-continue.ts'

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId('continue-rpc'), payload }
}

describe('session.prompt continuation', () => {
  it('admits a plugin-sourced notice and ignores client content', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(UserQuestionService)
    const session = ctx.sessions.create()
    const followup = vi.fn()
    const agent = {
      id: session.id,
      session,
      status: 'idle',
      ctx,
      followup,
      inbox: { nextTurn: [], nextStep: [] },
    } as unknown as Agent
    ctx.agents.register(agent)
    const api = createApiProxy(ctx, { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' })

    const result = await api.sessions.prompt(request({
      sessionId: session.id as SessionId,
      mode: 'queue' as const,
      content: [{ type: 'text' as const, text: 'typed continue' }],
      continuation: true as const,
    }))
    expect(result.result).toEqual({ ok: true, value: { accepted: true } })
    expect(followup).toHaveBeenCalledTimes(1)
    const message = followup.mock.calls[0]?.[0] as UserMessage
    expect(message.content).toEqual([{ type: 'text', text: AGENT_CONTINUE_PROMPT }])
    expect(message.source).toEqual({
      kind: 'plugin',
      plugin: AGENT_CONTINUE_PLUGIN,
      form: 'notice',
      summary: AGENT_CONTINUE_SUMMARY,
    })
    await ctx.fiber.dispose()
  })
})
