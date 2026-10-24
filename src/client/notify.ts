// Desktop notifications per project, with Claude's levels: every new message; the main
// conversation and what needs you; only what needs you; nothing. DSH itself sends none, so this
// watches sessions stop running and raises the page's own Notification, only while the DSH window
// is not in front (when it is, the sidebar's marks already say it). Clicking one opens the session.
import { callHost, type NotifyLevel } from './api.ts'
import type { MessageKey, Translate } from './locale.ts'

/** Mirrors NotifyTarget in src/api.ts. */
interface NotifyTarget {
  sessionId: string
  kind: 'main' | 'thread'
  mainSessionId: string
  projectTitle: string
  level: NotifyLevel
  waiting: boolean
  n: number | null
  title: string | null
  status: string | null
  text: string
}

/** Whether a project at `level` wants to hear that this session finished. */
export function wantsNotification(level: NotifyLevel, kind: 'main' | 'thread', waiting: boolean): boolean {
  switch (level) {
    case 'all': return true
    case 'attention': return kind === 'main' || waiting
    case 'waiting': return kind === 'thread' && waiting
    case 'none': return false
  }
}

interface StatusSource {
  getSnapshot(): ReadonlyMap<string, { running?: boolean }>
  subscribe(listener: () => void): () => void
}

const STATUS_KEYS: Record<string, MessageKey> = {
  done: 'status.done',
  blocked: 'status.blocked',
  needs_decision: 'status.needsDecision',
  failed: 'status.failed',
  'no-report': 'status.noReport',
}

function message(target: NotifyTarget, t: Translate): { title: string; body: string } {
  if (target.kind === 'main') return { title: target.projectTitle, body: t('notifyMsg.main', { text: target.text || '…' }) }
  const title = `${target.projectTitle} · #${target.n} ${target.title}`
  if (target.waiting) return { title, body: t('notifyMsg.waiting', { text: target.text || '…' }) }
  return { title, body: `${t(STATUS_KEYS[target.status ?? 'no-report'] ?? 'status.noReport')}${target.text.length > 0 ? `：${target.text}` : ''}` }
}

const inBackground = () => typeof document === 'undefined' || document.visibilityState !== 'visible' || !document.hasFocus()

export function startNotifications(deps: {
  status: StatusSource | undefined
  openSession: (sessionId: string) => void
  openThread: (threadId: string) => void
  t: Translate
}): () => void {
  const { status } = deps
  if (status === undefined || typeof Notification === 'undefined') return () => {}
  let running = new Set<string>()
  let finished = new Set<string>()
  let pending: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const flush = async () => {
    const ids = [...finished]
    finished = new Set()
    if (ids.length === 0 || !inBackground()) return
    const targets = await callHost<NotifyTarget[]>('notifications.describe', { ids }).catch(() => [])
    const wanted = targets.filter((target) => wantsNotification(target.level, target.kind, target.waiting))
    if (disposed || wanted.length === 0) return
    if (Notification.permission === 'default') await Notification.requestPermission().catch(() => 'denied')
    if (Notification.permission !== 'granted') return
    for (const target of wanted) {
      const { title, body } = message(target, deps.t)
      // One notification per session: a newer one replaces it.
      const shown = new Notification(title, { body, tag: `dsh-threads:${target.sessionId}` })
      shown.onclick = () => {
        window.focus()
        deps.openSession(target.mainSessionId)
        if (target.kind === 'thread') deps.openThread(target.sessionId)
        shown.close()
      }
    }
  }

  const off = status.subscribe(() => {
    const next = new Set([...status.getSnapshot()].filter(([, state]) => state.running === true).map(([id]) => id))
    for (const id of running) if (!next.has(id)) finished.add(id)
    running = next
    if (finished.size === 0) return
    // Threads finishing together, and the main conversation they wake, arrive as one batch.
    if (pending !== undefined) clearTimeout(pending)
    pending = setTimeout(() => { void flush() }, 600)
  })
  running = new Set([...status.getSnapshot()].filter(([, state]) => state.running === true).map(([id]) => id))

  return () => {
    disposed = true
    if (pending !== undefined) clearTimeout(pending)
    off()
  }
}
