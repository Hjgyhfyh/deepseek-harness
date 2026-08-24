/**
 * The workspace browser's viewing store: the session-list grouping mode,
 * persisted across reloads. Module level exports the factory only (a
 * module-level handle would pin the store identity across plugin reloads);
 * register() receives the factory and the browser derives its PropsStore
 * share from the return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Browser-local order account for the hierarchy-free flat Session list. */
export const FLAT_SESSION_ORDER_KEY = '__flat_session_order__'

/** Session-list grouping mode: workspace sections or one flat recency list. */
export type SessionGroupBy = 'workspace' | 'flat'
/** Session order: user-arranged only, or user-arranged plus activity promotion. */
export type SessionOrderBy = 'manual' | 'updated'

/** Workspace browser viewing state persisted across surface remounts and reloads. */
type WorkspaceViewState = {
  groupBy: SessionGroupBy
  orderBy: SessionOrderBy
  /** Explicit zero-or-five-session state keyed by Workspace group identity. */
  groupExpansion: Record<string, boolean>
  /** Shared editable order per Workspace group plus the browser-local flat-list account. */
  sessionOrderByAccount: Record<string, string[]>
  /** Last observed update timestamps per order account for one-time promotion events. */
  sessionUpdatedAtByAccount: Record<string, Record<string, number>>
  /** Registry-global pinned Session ids; pinned rows lead their section (browser-local preference). */
  pinnedSessionIds: string[]
  /** User-arranged order inside the pinned band (missing ids trail by pin recency). */
  pinnedOrder: string[]
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type WorkspaceViewActions = {
  setGroupBy: (draft: WorkspaceViewState, mode: SessionGroupBy) => void
  setOrderBy: (draft: WorkspaceViewState, mode: SessionOrderBy) => void
  setGroupExpanded: (draft: WorkspaceViewState, key: string, expanded: boolean) => void
  retainAccountKeys: (draft: WorkspaceViewState, workspaceKeys: readonly string[]) => void
  syncSessionOrderAccount: (
    draft: WorkspaceViewState,
    accountKey: string,
    order: string[],
    updatedAt: Record<string, number>,
  ) => void
  setSessionOrder: (draft: WorkspaceViewState, accountKey: string, order: string[]) => void
  /** Pin or unpin a Session (registry-global, order-preserving membership). */
  setPinned: (draft: WorkspaceViewState, sessionId: string, pinned: boolean) => void
  /**
   * Move one pinned Session to sit just before another pinned anchor within
   * the pinned band (`anchor === null` moves it to the very top).
   */
  movePinned: (draft: WorkspaceViewState, sessionId: string, anchorId: string | null) => void
}

/**
 * Create the workspace browser viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWorkspaceViewStore(): EngineStoreHandle<WorkspaceViewState, WorkspaceViewActions> {
  return defineStore({
    init: (): WorkspaceViewState => ({
      groupBy: 'workspace',
      orderBy: 'updated',
      groupExpansion: {},
      sessionOrderByAccount: {},
      sessionUpdatedAtByAccount: {},
      pinnedSessionIds: [],
      pinnedOrder: [],
    }),
    // v7: adds pinnedOrder (manual ordering inside the pinned band);
    // rehydration replaces the draft wholesale, so the v6 payload would
    // leave the field undefined.
    persist: 'dsh.workspace.view.v7',
    actions: {
      setGroupBy: (d, mode: SessionGroupBy) => { d.groupBy = mode },
      setOrderBy: (d, mode: SessionOrderBy) => { d.orderBy = mode },
      setGroupExpanded: (d, key: string, expanded: boolean) => { d.groupExpansion[key] = expanded },
      retainAccountKeys: (d, workspaceKeys: readonly string[]) => {
        const retained = new Set(workspaceKeys)
        d.groupExpansion = Object.fromEntries(
          Object.entries(d.groupExpansion).filter(([key]) => retained.has(key)),
        )
        d.sessionOrderByAccount = Object.fromEntries(
          Object.entries(d.sessionOrderByAccount).filter(([key]) => retained.has(key)),
        )
        d.sessionUpdatedAtByAccount = Object.fromEntries(
          Object.entries(d.sessionUpdatedAtByAccount).filter(([key]) => retained.has(key)),
        )
        // Pins are registry-global like the archive set: never pruned here.
      },
      syncSessionOrderAccount: (d, accountKey: string, order: string[], updatedAt: Record<string, number>) => {
        d.sessionOrderByAccount[accountKey] = order
        d.sessionUpdatedAtByAccount[accountKey] = updatedAt
      },
      setSessionOrder: (d, accountKey: string, order: string[]) => {
        d.sessionOrderByAccount[accountKey] = order
      },
      setPinned: (d, sessionId: string, pinned: boolean) => {
        const set = new Set(d.pinnedSessionIds)
        if (pinned) {
          set.add(sessionId)
          // A fresh pin trails the arranged band; an existing pin stays put.
          d.pinnedOrder = d.pinnedOrder.filter(id => id !== sessionId)
        } else {
          set.delete(sessionId)
          d.pinnedOrder = d.pinnedOrder.filter(id => id !== sessionId)
        }
        d.pinnedSessionIds = [...set]
      },
      movePinned: (d, sessionId: string, anchorId: string | null) => {
        if (!d.pinnedSessionIds.includes(sessionId)) return
        if (anchorId !== null && !d.pinnedSessionIds.includes(anchorId)) return
        // The band's current visual order: arranged ids first (stored
        // sequence), then unarranged ids by pin recency; the dragged row is
        // lifted out of both.
        const arranged = d.pinnedOrder.filter(id =>
          id !== sessionId && d.pinnedSessionIds.includes(id))
        const arrangedSeen = new Set(arranged)
        const trailing = d.pinnedSessionIds.filter(id => id !== sessionId && !arrangedSeen.has(id))
        const withoutDragged = [...arranged, ...trailing]
        if (anchorId === null) {
          d.pinnedOrder = [sessionId, ...withoutDragged]
          return
        }
        const at = Math.max(0, withoutDragged.indexOf(anchorId))
        const next = [...withoutDragged]
        next.splice(at, 0, sessionId)
        d.pinnedOrder = next
      },
    },
  })
}
