// The left sidebar, as in Claude: threads are not listed (they are reached from their main
// conversation), and a project's main conversation row shows "↳ N" and the state of its
// threads. DSH's session list is one closed slot with no row filter, so thread rows are hidden
// by a generated stylesheet keyed on the rows' `data-row-key="session:<id>"`, and "↳ N" sits
// before the row's time cell (`slot | title | time | actions`).
import { createElement, useSyncExternalStore } from 'react'
import { callHost } from './api.ts'
import { ThreadGlyph } from './glyphs.tsx'
import { ProjectIcon } from './icons.tsx'
import { threadsRevision } from './threads.ts'

interface MainKind {
  icon: string
  threads: number
  running: number
  waiting: number
}

interface Kinds {
  threads: ReadonlySet<string>
  mains: ReadonlyMap<string, MainKind>
}

const SIDEBAR_STYLE_ID = '@fky/dsh-threads/sidebar'

let kinds: Kinds = { threads: new Set(), mains: new Map() }
const listeners = new Set<() => void>()

const rowSelector = (id: string) => `[data-row-key="session:${id.replace(/["\\]/g, '\\$&')}"]`

/** The generated rules: hide every thread row, add "↳ N" to main conversation rows. */
export function sidebarCss(next: Kinds): string {
  const rules: string[] = []
  if (next.threads.size > 0) rules.push(`${[...next.threads].map(rowSelector).join(',')}{display:none!important}`)
  for (const [id, main] of next.mains) {
    if (main.threads === 0) continue
    rules.push(`${rowSelector(id)}>span:nth-child(3)::before{content:"↳ ${main.threads}";margin-right:8px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}`)
  }
  return rules.join('\n')
}

function writeSidebarCss(next: Kinds): void {
  if (typeof document === 'undefined') return
  let tag = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${SIDEBAR_STYLE_ID}"]`)
  if (tag === null) {
    tag = document.createElement('style')
    tag.dataset.plugin = '@fky/dsh-threads'
    tag.dataset.pluginCss = SIDEBAR_STYLE_ID
    document.head.appendChild(tag)
  }
  tag.textContent = sidebarCss(next)
}

function publish(next: Kinds): void {
  kinds = next
  writeSidebarCss(next)
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
    const next = await callHost<{ threads: string[]; mains: ({ id: string } & MainKind)[] }>('sessions.kinds').catch(() => undefined)
    if (!disposed && next !== undefined) {
      publish({ threads: new Set(next.threads), mains: new Map(next.mains.map(({ id, ...main }) => [id, main])) })
    }
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
    document.querySelector(`style[data-plugin-css="${SIDEBAR_STYLE_ID}"]`)?.remove()
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

/**
 * sidebar.session.row.leading entry for a main conversation: a raised hand when one of its
 * threads waits on the user, a breathing dot while any runs, otherwise the project's icon (as
 * Claude's sidebar shows it). DSH puts the row's own status dot here instead whenever the main
 * conversation itself is busy.
 */
export function MainRowMark({ sessionId, t }: { sessionId: string; t: (key: 'badge.waiting' | 'badge.running', vars: { count: number }) => string }) {
  const main = useKinds().mains.get(sessionId)
  if (main === undefined) return null
  if (main.waiting > 0) return createElement(ThreadGlyph, { state: 'waiting', label: t('badge.waiting', { count: main.waiting }) })
  if (main.running > 0) return createElement(ThreadGlyph, { state: 'running', label: t('badge.running', { count: main.running }) })
  return createElement('span', { className: 'dsht-row-icon' }, createElement(ProjectIcon, { id: main.icon, size: 14 }))
}
