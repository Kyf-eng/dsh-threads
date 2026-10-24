// Which sessions are threads / project main conversations, for the sidebar row badges.
import { createElement, useSyncExternalStore } from 'react'
import { callHost } from './api.ts'
import { ProjectsIcon, ThreadsIcon } from './icons.tsx'
import { threadsRevision } from './threads.ts'

interface Kinds {
  threads: ReadonlySet<string>
  mains: ReadonlySet<string>
}

let kinds: Kinds = { threads: new Set(), mains: new Set() }
const listeners = new Set<() => void>()

function publish(next: Kinds): void {
  kinds = next
  for (const listener of listeners) listener()
}

interface StatusSource {
  getSnapshot(): ReadonlyMap<string, { running?: boolean }>
  subscribe(listener: () => void): () => void
}

/** Reload on start, after this browser changes something, and when any session starts or stops. */
export function syncKinds(status: StatusSource | undefined): () => void {
  let disposed = false
  let pending: ReturnType<typeof setTimeout> | undefined
  const load = async () => {
    const next = await callHost<{ threads: string[]; mains: string[] }>('sessions.kinds').catch(() => undefined)
    if (!disposed && next !== undefined) publish({ threads: new Set(next.threads), mains: new Set(next.mains) })
  }
  const schedule = () => {
    if (pending !== undefined) clearTimeout(pending)
    pending = setTimeout(() => { void load() }, 300)
  }
  let runningKey = ''
  const offStatus = status?.subscribe(() => {
    const next = [...status.getSnapshot()].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(',')
    if (next !== runningKey) {
      runningKey = next
      schedule()
    }
  })
  const offRevision = threadsRevision.subscribe(schedule)
  void load()
  return () => {
    disposed = true
    if (pending !== undefined) clearTimeout(pending)
    offStatus?.()
    offRevision()
  }
}

/** Refresh after a project is created or removed in this browser. */
export const refreshKinds = () => threadsRevision.bump()

function useKinds(): Kinds {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, () => kinds)
}

/** sidebar.session.row.leading entry: a small mark on threads and project main conversations. */
export function SessionBadge({ sessionId, t }: { sessionId: string; t: (key: 'badge.thread' | 'badge.project') => string }) {
  const { threads, mains } = useKinds()
  if (threads.has(sessionId)) return createElement('span', { className: 'dsht-badge', title: t('badge.thread') }, createElement(ThreadsIcon, { size: 13 }))
  if (mains.has(sessionId)) return createElement('span', { className: 'dsht-badge', title: t('badge.project') }, createElement(ProjectsIcon, { size: 13 }))
  return null
}
