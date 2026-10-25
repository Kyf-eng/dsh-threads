// Desktop notifications per project, with Claude's levels: every new message; the main
// conversation and what needs you; only what needs you; nothing. DSH itself sends none, so this
// watches sessions stop running, or start waiting on an approval, a question or a plan, and raises
// the page's own Notification, only while the DSH window is not in front (when it is, the sidebar's
// marks already say it). Clicking one opens the session.
import { callHost, type NotifyLevel } from './api.ts'
import type { MessageKey, Translate } from './locale.ts'
import { type AskKind, type LiveStatus, parseLive, liveKey } from './threads.ts'

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
    case 'waiting': return waiting
    case 'none': return false
  }
}

interface StatusSource {
  getSnapshot(): ReadonlyMap<string, LiveStatus>
  subscribe(listener: () => void): () => void
}

const ASK_KEYS: Record<AskKind, MessageKey> = { approval: 'ask.approval', question: 'ask.question', 'plan-review': 'ask.planReview' }

const STATUS_KEYS: Record<string, MessageKey> = {
  done: 'status.done',
  blocked: 'status.blocked',
  needs_decision: 'status.needsDecision',
  failed: 'status.failed',
  'no-report': 'status.noReport',
}

function message(target: NotifyTarget, t: Translate, asking?: AskKind): { title: string; body: string } {
  const title = target.kind === 'main' ? target.projectTitle : `${target.projectTitle} · #${target.n} ${target.title}`
  if (asking !== undefined) return { title, body: t(ASK_KEYS[asking]) }
  if (target.kind === 'main') return { title: target.projectTitle, body: t('notifyMsg.main', { text: target.text || '…' }) }
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
  let running: ReadonlySet<string> = new Set<string>()
  let asking: ReadonlyMap<string, AskKind> = new Map()
  let finished = new Set<string>()
  /** Sessions that started waiting on the user since the last batch. */
  let started = new Map<string, AskKind>()
  let pending: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const flush = async () => {
    const asks = started
    const ids = [...new Set([...finished, ...asks.keys()])]
    finished = new Set()
    started = new Map()
    if (ids.length === 0 || !inBackground()) return
    const targets = await callHost<NotifyTarget[]>('notifications.describe', { ids }).catch(() => [])
    const wanted = targets.filter((target) => wantsNotification(target.level, target.kind, target.waiting || asks.has(target.sessionId)))
    if (disposed || wanted.length === 0) return
    if (Notification.permission === 'default') await Notification.requestPermission().catch(() => 'denied')
    if (Notification.permission !== 'granted') return
    for (const target of wanted) {
      const { title, body } = message(target, deps.t, asks.get(target.sessionId))
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
    const next = parseLive(liveKey(status.getSnapshot()))
    for (const id of running) if (!next.running.has(id)) finished.add(id)
    for (const [id, kind] of next.asking) if (!asking.has(id)) started.set(id, kind)
    running = next.running
    asking = next.asking
    if (finished.size === 0 && started.size === 0) return
    // Threads finishing together, and the main conversation they wake, arrive as one batch.
    if (pending !== undefined) clearTimeout(pending)
    pending = setTimeout(() => { void flush() }, 600)
  })
  const first = parseLive(liveKey(status.getSnapshot()))
  running = first.running
  asking = first.asking

  return () => {
    disposed = true
    if (pending !== undefined) clearTimeout(pending)
    off()
  }
}
