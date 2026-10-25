// Thread data for the panes: host calls, a refresh signal, and the right-sidebar address.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { callHost } from './api.ts'
import type { GlyphState } from './glyphs.tsx'

/** Mirrors ThreadSummary in src/api.ts. */
export interface ThreadView {
  id: string
  mainSessionId: string
  n: number
  title: string
  status: 'starting' | 'running' | 'idle' | 'failed'
  resolved: boolean
  /** Archived on its own; listed apart. */
  archived: boolean
  initiation: 'user_asked' | 'offer' | 'proposal'
  lastReport: { status: 'done' | 'blocked' | 'needs_decision' | 'failed'; summary: string; changedFiles: string[]; decisions: string[]; at: string } | null
  error: string | null
  worktree: { branch: string; path: string; removed: boolean } | null
  createdAt: string
  updatedAt: string
}

/** Mirrors ThreadCardInfo in src/source.ts (carried on our message sources and tool meta). */
export interface ThreadCardInfo {
  threadId: string
  n: number
  title: string
  status?: string
  summary?: string
  branch?: string
  decision?: string
  files?: string[]
}

/** Mirrors ProposalRecord in src/types.ts. */
export interface ProposalView {
  id: string
  mainSessionId: string
  title: string
  task: string
  state: 'pending' | 'queued' | 'started' | 'dismissed'
  worktree: boolean
  threadId: string | null
  createdAt: string
  expiresAt: string
}

export interface ThreadDetail extends ThreadView {
  projectTitle: string | null
}

export interface SessionRole {
  project: { id: string; title: string; mainSessionId: string } | null
  thread: boolean
}

/** Bumped after any change this browser makes (resolve, reopen), so panes reload. */
let revision = 0
const listeners = new Set<() => void>()
export const threadsRevision = {
  bump(): void {
    revision += 1
    for (const listener of listeners) listener()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  get: (): number => revision,
}

export function useThreadsRevision(): number {
  return useSyncExternalStore(threadsRevision.subscribe, threadsRevision.get)
}

/** Load a host value, reloading whenever `deps` change; keeps the last value while reloading. */
/** Requests in flight, so the cards of one conversation refreshing together share one call. */
const inFlight = new Map<string, Promise<unknown>>()

function sharedCall<T>(method: string, payload: unknown): Promise<T> {
  const key = `${method}\n${JSON.stringify(payload)}`
  let pending = inFlight.get(key)
  if (pending === undefined) {
    pending = callHost<T>(method, payload).finally(() => inFlight.delete(key))
    inFlight.set(key, pending)
  }
  return pending as Promise<T>
}

export function useHostValue<T>(method: string | null, payload: unknown, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined)
  useEffect(() => {
    if (method === null) {
      setValue(undefined)
      return
    }
    let live = true
    sharedCall<T>(method, payload).then((next) => { if (live) setValue(next) }, () => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, ...deps])
  return value
}

/** What DSH's client knows about a live session (uiSession.sessionStatus). */
export interface LiveStatus {
  running?: boolean
  pendingInteraction?: { kind?: string }
}

export type UseStatus = <T>(selector: (statuses: ReadonlyMap<string, LiveStatus>) => T) => T

/** Interactions that wait on the user; the ones DSH's own session list marks (dsh-client-ui-workspace). */
export type AskKind = 'approval' | 'question' | 'plan-review'
const ASK_KINDS: ReadonlySet<string> = new Set(['approval', 'question', 'plan-review'])

/** Sessions that run, and sessions that wait on the user (an approval, a question, a plan to review). */
export interface Live {
  running: ReadonlySet<string>
  asking: ReadonlyMap<string, AskKind>
}

/** Every session's live state as one string: selectors must return stable values. */
export function liveKey(statuses: ReadonlyMap<string, LiveStatus>): string {
  const tokens: string[] = []
  for (const [id, status] of statuses) {
    if (status.running === true) tokens.push(`r:${id}`)
    const kind = status.pendingInteraction?.kind
    if (kind !== undefined && ASK_KINDS.has(kind)) tokens.push(`a:${id}:${kind}`)
  }
  return tokens.sort().join(',')
}

export function parseLive(key: string): Live {
  const running = new Set<string>()
  const asking = new Map<string, AskKind>()
  for (const token of key.split(',')) {
    if (token.startsWith('r:')) running.add(token.slice(2))
    else if (token.startsWith('a:')) {
      const at = token.lastIndexOf(':')
      asking.set(token.slice(2, at), token.slice(at + 1) as AskKind)
    }
  }
  return { running, asking }
}

/** Live state of every session, re-rendering only when it changes; `key` also serves as a reload dependency. */
export function useLive(useSessionStatus: UseStatus): Live & { key: string } {
  const key = useSessionStatus(liveKey)
  return useMemo(() => ({ ...parseLive(key), key }), [key])
}

/** Sections of the threads list, as in Claude's threads panel. */
export interface ThreadGroups<T> {
  /** Raised hand: the thread stopped to ask the user something. */
  waiting: T[]
  running: T[]
  /** Not running and not waiting: done, stopped, failed, or never reported. */
  idle: T[]
  resolved: T[]
  archived: T[]
}

/**
 * Sort threads into the list's sections, newest activity first, keeping those whose number,
 * title or latest summary contains `query`. `stateOf` is glyphState with the live running set.
 */
export function groupThreads<T extends Pick<ThreadView, 'n' | 'title' | 'archived' | 'lastReport' | 'updatedAt'>>(
  threads: readonly T[],
  stateOf: (thread: T) => GlyphState,
  query = '',
): ThreadGroups<T> {
  const needle = query.trim().toLowerCase().replace(/^#/, '')
  const matches = (thread: T) => needle.length === 0 || String(thread.n) === needle
    || thread.title.toLowerCase().includes(needle) || (thread.lastReport?.summary.toLowerCase().includes(needle) ?? false)
  const groups: ThreadGroups<T> = { waiting: [], running: [], idle: [], resolved: [], archived: [] }
  const newestFirst = [...threads].filter(matches).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.n - a.n)
  for (const thread of newestFirst) {
    if (thread.archived) {
      groups.archived.push(thread)
      continue
    }
    const state = stateOf(thread)
    const group = state === 'waiting' ? groups.waiting
      : state === 'running' || state === 'queued' ? groups.running
      : state === 'resolved' ? groups.resolved
      : groups.idle
    group.push(thread)
  }
  return groups
}

/** Right-sidebar resource address of a thread's conversation. */
const THREAD_ADDRESS = 'dsh-resource://dsh-threads/session/'

export function threadAddress(threadId: string): string {
  return `${THREAD_ADDRESS}${encodeURIComponent(threadId)}`
}

export function parseThreadAddress(value: string): string | undefined {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (url.protocol !== 'dsh-resource:' || url.hostname.toLowerCase() !== 'dsh-threads') return undefined
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length !== 2 || parts[0] !== 'session' || parts[1] === undefined) return undefined
  try {
    return decodeURIComponent(parts[1])
  } catch {
    return undefined
  }
}

export const THREAD_ADDRESS_PATTERN = `${THREAD_ADDRESS}**`
