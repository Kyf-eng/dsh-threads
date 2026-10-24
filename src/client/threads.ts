// Thread data for the panes: host calls, a refresh signal, and the right-sidebar address.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { callHost } from './api.ts'

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
