// The left sidebar, as in Claude: projects have their own section (SidebarProjects.tsx), so
// DSH's workspace list shows neither a project's main conversation nor its threads, and drops a
// workspace altogether when nothing else is in it. DSH's session list is one closed slot with no
// row filter, so those rows are hidden by a generated stylesheet keyed on the rows'
// `data-row-key` (`session:<id>`, `workspace:<id>`, and the `overflow:<id>` "show N more" row).
import { useSyncExternalStore } from 'react'
import { callHost } from './api.ts'
import { threadsRevision } from './threads.ts'

export interface MainKind {
  icon: string
  threads: number
  running: number
  waiting: number
}

interface Kinds {
  threads: ReadonlySet<string>
  mains: ReadonlyMap<string, MainKind>
  /** Workspaces where DSH would show nothing but project sessions (projectOnlyWorkspaces). */
  hiddenWorkspaces: ReadonlySet<string>
}

const SIDEBAR_STYLE_ID = '@fky/dsh-threads/sidebar'

let kinds: Kinds = { threads: new Set(), mains: new Map(), hiddenWorkspaces: new Set() }
const listeners = new Set<() => void>()

const rowSelector = (kind: 'session' | 'workspace' | 'overflow', id: string) => `[data-row-key="${kind}:${id.replace(/["\\]/g, '\\$&')}"]`

/** Rows the "Projects" section shows before "Show N more". */
export const SIDEBAR_VISIBLE = 8

/** The "Projects" section's rows: active projects, pinned first, then by latest activity. */
export function sidebarProjects<P extends { archived: boolean; pinned: boolean; lastActivity: string }>(projects: readonly P[]): P[] {
  return projects
    .filter((project) => !project.archived)
    .sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.lastActivity.localeCompare(a.lastActivity)))
}

/** What DSH's session list knows about a session (its WorkspaceBrowser reads the same fields). */
export interface SessionSummary {
  blank?: boolean
  origin?: string
}

/**
 * Workspaces to drop from DSH's list: those holding a project session and no other session DSH
 * would show. DSH's own rule (`sessionVisible` in dsh-client-ui-workspace) skips unknown, blank
 * (unless current), subagent and archived sessions.
 */
export function projectOnlyWorkspaces(
  workspaces: readonly { workspaceId: string; sessionIds: readonly string[] }[],
  sessions: Readonly<Record<string, SessionSummary | undefined>>,
  archived: ReadonlySet<string>,
  projectSessions: ReadonlySet<string>,
  current: string | undefined,
): string[] {
  const shown = (id: string) => {
    const session = sessions[id]
    return session !== undefined && session.origin !== 'subagent' && (session.blank !== true || id === current) && !archived.has(id)
  }
  return workspaces
    .filter((workspace) => workspace.sessionIds.some((id) => projectSessions.has(id))
      && workspace.sessionIds.every((id) => projectSessions.has(id) || !shown(id)))
    .map((workspace) => workspace.workspaceId)
}

/** The generated rule hiding project sessions and project-only workspaces in DSH's list. */
export function sidebarCss(next: Kinds): string {
  const hidden = [
    ...[...next.threads, ...next.mains.keys()].map((id) => rowSelector('session', id)),
    ...[...next.hiddenWorkspaces].flatMap((id) => [rowSelector('workspace', id), rowSelector('overflow', id)]),
  ]
  return hidden.length === 0 ? '' : `${hidden.join(',')}{display:none!important}`
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
      publish({ ...kinds, threads: new Set(next.threads), mains: new Map(next.mains.map(({ id, ...main }) => [id, main])) })
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

/** Set by the sidebar's projects section, which reads DSH's workspace and session lists. */
export function setHiddenWorkspaces(ids: readonly string[]): void {
  if (ids.length === kinds.hiddenWorkspaces.size && ids.every((id) => kinds.hiddenWorkspaces.has(id))) return
  publish({ ...kinds, hiddenWorkspaces: new Set(ids) })
}

/** Refresh after a project is created or removed in this browser. */
export const refreshKinds = () => threadsRevision.bump()

/** Thread counts and states per main conversation, for the sidebar's project rows. */
export function useKinds(): Kinds {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, () => kinds)
}
