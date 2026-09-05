/**
 * Host continuation admission: `session.prompt` with `continuation: true`
 * followups a plugin-sourced notice instead of a user bubble. A live
 * `max-tokens` step steers the same notice before the turn closes.
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { agentEvents } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '../src/api-proxy.ts'
import {
  AGENT_CONTINUE_PLUGIN, AGENT_CONTINUE_PROMPT, AGENT_CONTINUE_SUMMARY,
  installMaxTokensAutoContinue,
  openTurnLastFinishIsMaxTokens,
} from '../src/agent-continue.ts'

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId('continue-rpc'), payload }
}

function appendFinish(session: Session, kind: 'stop' | 'max-tokens', turn = 1, step = 1): void {
  session.append('assistant/chunk', { turn, step, chunk: { type: 'finish', reason: { kind } } })
}

function stubAgent(ctx: Context, session: Session, overrides: Partial<Agent> = {}): Agent {
  return {
    id: session.id,
    session,
    status: 'running',
    ctx,
    followup: vi.fn(),
    steer: vi.fn(),
    inbox: { nextTurn: [], nextStep: [] },
    ...overrides,
  } as unknown as Agent
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
      sessionId: session.id,
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

describe('openTurnLastFinishIsMaxTokens', () => {
  it('reads only the open turn\'s latest finish', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create()
    const agent = stubAgent(ctx, session)

    expect(openTurnLastFinishIsMaxTokens(agent)).toBe(false)

    appendFinish(session, 'max-tokens')
    expect(openTurnLastFinishIsMaxTokens(agent)).toBe(true)

    session.append('turn/start', { turn: 1 })
    appendFinish(session, 'stop')
    expect(openTurnLastFinishIsMaxTokens(agent)).toBe(false)

    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    session.append('turn/start', { turn: 2 })
    appendFinish(session, 'max-tokens', 2)
    expect(openTurnLastFinishIsMaxTokens(agent)).toBe(true)

    await ctx.fiber.dispose()
  })
})

describe('installMaxTokensAutoContinue', () => {
  async function dispatchStopping(agent: Agent, signal: AbortSignal): Promise<void> {
    await agentEvents(agent.ctx, agent).serial('agent/turn-stopping', { turn: 1, signal })
  }

  it('steers the Host continue notice after a max-tokens finish', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(AgentRegistry)
    installMaxTokensAutoContinue(ctx)
    const session = ctx.sessions.create()
    session.append('turn/start', { turn: 1 })
    appendFinish(session, 'max-tokens')
    const steer = vi.fn()
    const agent = stubAgent(ctx, session, { steer: steer as Agent['steer'] })

    await dispatchStopping(agent, new AbortController().signal)

    expect(steer).toHaveBeenCalledTimes(1)
    const message = steer.mock.calls[0]?.[0] as UserMessage
    expect(message.content).toEqual([{ type: 'text', text: AGENT_CONTINUE_PROMPT }])
    expect(message.source).toEqual({
      kind: 'plugin',
      plugin: AGENT_CONTINUE_PLUGIN,
      form: 'notice',
      summary: AGENT_CONTINUE_SUMMARY,
    })
    await ctx.fiber.dispose()
  })

  it('does not steer a completed last step, an aborted signal, or a queued next step', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(AgentRegistry)
    installMaxTokensAutoContinue(ctx)

    const completed = ctx.sessions.create()
    completed.append('turn/start', { turn: 1 })
    appendFinish(completed, 'stop')
    const completedSteer = vi.fn()
    await dispatchStopping(
      stubAgent(ctx, completed, { steer: completedSteer as Agent['steer'] }),
      new AbortController().signal,
    )
    expect(completedSteer).not.toHaveBeenCalled()

    const aborted = ctx.sessions.create()
    aborted.append('turn/start', { turn: 1 })
    appendFinish(aborted, 'max-tokens')
    const abortedSteer = vi.fn()
    const controller = new AbortController()
    controller.abort()
    await dispatchStopping(
      stubAgent(ctx, aborted, { steer: abortedSteer as Agent['steer'] }),
      controller.signal,
    )
    expect(abortedSteer).not.toHaveBeenCalled()

    const queued = ctx.sessions.create()
    queued.append('turn/start', { turn: 1 })
    appendFinish(queued, 'max-tokens')
    const queuedSteer = vi.fn()
    await dispatchStopping(
      stubAgent(ctx, queued, {
        steer: queuedSteer as Agent['steer'],
        inbox: {
          nextTurn: [],
          nextStep: [createUserMessage({
            content: [{ type: 'text', text: 'already steered' }],
            source: { kind: 'plugin', plugin: 'other' },
          })],
        } as Agent['inbox'],
      }),
      new AbortController().signal,
    )
    expect(queuedSteer).not.toHaveBeenCalled()

    await ctx.fiber.dispose()
  })
})
