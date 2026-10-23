// Resolved threads get a low-precedence "pending interaction" so the composer chain can swap
// in ResolvedComposer for them. The sidebar ignores unknown interaction kinds, so no badge appears.
import { callHost } from './api.ts'
import { threadsRevision } from './threads.ts'

export const RESOLVED_KIND = 'dsh-threads-resolved'

export interface ResolvedInteraction {
  readonly key: string
  readonly sessionId: string
  readonly kind: typeof RESOLVED_KIND
}

type Publish = (interaction: ResolvedInteraction, delegate: () => void) => () => void

interface StatusSource {
  getSnapshot(): ReadonlyMap<string, { running?: boolean }>
  subscribe(listener: () => void): () => void
}

/**
 * Keep one published interaction per resolved thread, re-reading the host list on start,
 * after this browser resolves or reopens a thread, and whenever a session starts or stops.
 */
export function syncResolved(publish: Publish, status: StatusSource | undefined): () => void {
  const active = new Map<string, () => void>()
  let disposed = false
  let pending: ReturnType<typeof setTimeout> | undefined

  const sync = async () => {
    const ids = new Set(await callHost<string[]>('threads.resolved').catch(() => [...active.keys()]))
    if (disposed) return
    for (const [id, unpublish] of active) {
      if (!ids.has(id)) {
        unpublish()
        active.delete(id)
      }
    }
    for (const id of ids) {
      if (!active.has(id)) active.set(id, publish({ key: `${RESOLVED_KIND}:${id}`, sessionId: id, kind: RESOLVED_KIND }, () => {}))
    }
  }
  const schedule = () => {
    if (pending !== undefined) clearTimeout(pending)
    pending = setTimeout(() => { void sync() }, 150)
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
  void sync()

  return () => {
    disposed = true
    if (pending !== undefined) clearTimeout(pending)
    offStatus?.()
    offRevision()
    for (const unpublish of active.values()) unpublish()
    active.clear()
  }
}

export async function setThreadResolved(threadId: string, resolved: boolean): Promise<void> {
  await callHost(resolved ? 'threads.resolve' : 'threads.reopen', { id: threadId })
  threadsRevision.bump()
}
