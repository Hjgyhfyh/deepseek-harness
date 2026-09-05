// @vitest-environment jsdom
/**
 * Composer approval takeover: command-line extraction, refuse/allow, Escape
 * as Reject on the overlay stack, and one-shot re-arm on a lost receipt.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RpcReceipt } from '@deepseek-ai/dsh-api-remotes/client'
import { RpcId } from '@deepseek-ai/dsh-client-connection/client'
import {
  conversationContextKey, createSnapshotStore, EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS,
  PendingWait,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ConversationSnapshot, RunningToolCall, SessionId, SessionListState, WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { subscribeOverlayEscape } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ApprovalComposerProps, ApprovalWait } from '../src/client/contract/slots.ts'
import { ApprovalPanel, commandOf } from '../src/client/skeleton/ApprovalPanel.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const SID = 's1' as SessionId

const t: ApprovalComposerProps['t'] = makeTranslate(zh, commonZh)

function running(argsRaw: string): RunningToolCall {
  return {
    callId: 'c1', name: 'bash', argsRaw, turn: 1, step: 1, time: 0, callView: null, subCalls: [],
  }
}

function snapshotOf(overrides: Partial<ConversationSnapshot> = {}): ConversationSnapshot {
  return {
    sessionId: SID, views: EMPTY_CONVERSATION_VIEWS, chat: EMPTY_CHAT_SNAPSHOT,
    nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [],
    pending: [], queue: [], running: true, composerPhase: 'active', removed: false,
    openState: 'open', openError: null, hasMore: false, loadingOlder: false,
    promptError: null, blank: false, subagent: null, lastAgentError: null,
    ...overrides,
  }
}

/** Chat index keyed the way `rootToolCall` looks up a paired running call. */
function snapshotWithCommand(command: string): ConversationSnapshot {
  const call = running(JSON.stringify({ command }))
  const key = conversationContextKey('tool-call', call.callId)
  const node = {
    key, id: call.callId, target: 'chat' as const, kind: 'tool-call' as const,
    anchorSeq: 1, location: { kind: 'session' as const }, visibility: 'visible' as const,
    data: { root: call },
  }
  return snapshotOf({
    runningCalls: [call],
    chat: {
      ...EMPTY_CHAT_SNAPSHOT,
      nodes: {
        get: (lookup: string) => lookup === key ? node : undefined,
        values: () => [node],
      },
    },
  })
}

function wait(
  payload: ApprovalWait['payload'] = { approvalId: 'ap1', toolName: 'bash' } as ApprovalWait['payload'],
  respond = vi.fn(() => Promise.resolve<RpcReceipt>({ accepted: true })),
) {
  return { carrier: new PendingWait('approval', RpcId('a-1'), SID, payload, respond), respond }
}

function envelope(outcome: 'allowed-once' | 'rejected', approvalId = 'ap1') {
  return {
    type: 'client-response', rpcId: RpcId('a-1'),
    result: { ok: true, value: { sessionId: SID, approvalId, outcome } },
  }
}

function mount(
  payload: ApprovalWait['payload'] = { approvalId: 'ap1', toolName: 'bash' } as ApprovalWait['payload'],
  over: { snapshot?: ConversationSnapshot; respond?: ReturnType<typeof wait>['respond'] } = {},
) {
  const { carrier, respond } = wait(payload, over.respond)
  const snapshot = over.snapshot ?? snapshotOf()
  const kit = {
    sessionId: SID,
    session: snapshot,
    interactions: [carrier],
    useSession: bindSnapshotSelector(createSnapshotStore(snapshot)),
    useSessions: (() => { throw new Error('unused') }) as unknown as SnapshotSelectorHook<SessionListState>,
    useWorkspaces: (() => { throw new Error('unused') }) as unknown as SnapshotSelectorHook<WorkspaceListState>,
    useProjection: (() => undefined) as never,
    useInput: (() => { throw new Error('unused') }) as never,
    inputActions: { setDraft: () => {}, submit: () => {} } as never,
    t,
  }
  const view = render(<ApprovalPanel matched={carrier} {...kit} />)
  return { view, carrier, respond }
}

describe('commandOf', () => {
  it('reads a bash-family command and hides missing or unparseable args', () => {
    expect(commandOf(undefined)).toBeUndefined()
    expect(commandOf(running('{'))).toBeUndefined()
    expect(commandOf(running('{"n":1}'))).toBeUndefined()
    expect(commandOf(running('{"command":1}'))).toBeUndefined()
    expect(commandOf(running('{"command":"ls -la"}'))).toBe('ls -la')
  })
})

describe('ApprovalPanel', () => {
  it('renders the justification, escalation fallback, and paired command', () => {
    mount({ approvalId: 'ap1', toolName: 'rm', reason: 'wipe tmp' } as ApprovalWait['payload'])
    expect(screen.getByText(zh['approval.waiting'])).toBeTruthy()
    expect(screen.getByText('wipe tmp')).toBeTruthy()
    expect(screen.getByRole('group', { name: zh['approval.detail.aria'] })).toBeTruthy()

    cleanup()
    mount({ approvalId: 'ap1', toolName: 'rm' } as ApprovalWait['payload'])
    expect(screen.getByText('工具 rm 请求越权执行')).toBeTruthy()

    cleanup()
    mount(
      { approvalId: 'ap1', toolName: 'bash', callId: 'c1' } as ApprovalWait['payload'],
      { snapshot: snapshotWithCommand('rm -rf /tmp/x') },
    )
    expect(screen.getByText('rm -rf /tmp/x')).toBeTruthy()
  })

  it('refuses or allows once through the reject and allow buttons', () => {
    const refused = mount()
    fireEvent.click(screen.getByRole('button', { name: zh['approval.reject'] }))
    expect(refused.respond).toHaveBeenCalledWith(envelope('rejected'))

    cleanup()
    const allowed = mount()
    fireEvent.click(screen.getByRole('button', { name: zh['approval.allowOnce'] }))
    expect(allowed.respond).toHaveBeenCalledWith(envelope('allowed-once'))
  })

  it('Escape refuses the wait like Reject, never Allow', () => {
    const { respond } = mount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(respond).toHaveBeenCalledWith(envelope('rejected'))
    expect(respond).not.toHaveBeenCalledWith(envelope('allowed-once'))
  })

  it('leaves the approval open when a later overlay owns Escape', () => {
    const { respond } = mount()
    const upper = vi.fn()
    const release = subscribeOverlayEscape(upper)
    try {
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(upper).toHaveBeenCalledTimes(1)
      expect(respond).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: zh['approval.allowOnce'] })).toBeTruthy()
    } finally {
      release()
    }
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith(envelope('rejected'))
  })

  it('does not refuse on Escape after a decision has been sent', () => {
    const { respond } = mount()
    fireEvent.click(screen.getByRole('button', { name: zh['approval.allowOnce'] }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith(envelope('allowed-once'))
  })

  it('re-arms Escape after a lost receipt', async () => {
    const { respond } = mount(
      { approvalId: 'ap1', toolName: 'bash' } as ApprovalWait['payload'],
      { respond: vi.fn(() => Promise.resolve<RpcReceipt>({ accepted: false, reason: 'not-pending' })) },
    )
    fireEvent.click(screen.getByRole('button', { name: zh['approval.reject'] }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: zh['approval.reject'] }).hasAttribute('disabled')).toBe(false)
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(respond).toHaveBeenCalledTimes(2)
  })
})
