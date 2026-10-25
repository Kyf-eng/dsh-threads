// The sidebar's "Projects" section, as in Claude: one row per project, opening its main
// conversation, above DSH's workspace list (which no longer lists project sessions, kinds.ts).
// DSH has no slot for a sidebar section, and 'sidebar.workspaces' cannot be wrapped (its child
// slots may be declared only once), so the section is portalled into the sidebar right after the
// panel rows: our "Projects" panel icon marks that <nav>, and an always-mounted entry in
// 'shell.overlay' renders the portal. Without the mark (DSH changed), nothing renders.
import { IconChevronDownOutlineRegular, IconPinFillRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { projectsStore, type ProjectView, useProjects } from './api.ts'
import { ThreadGlyph } from './glyphs.tsx'
import { PlusIcon, ProjectIcon } from './icons.tsx'
import {
  type MainKind,
  projectOnlyWorkspaces,
  type SessionSummary,
  setHiddenWorkspaces,
  SIDEBAR_VISIBLE,
  sidebarProjects,
  useKinds,
} from './kinds.ts'
import type { Translate } from './locale.ts'
import { NewProjectDialog, type PickFolder, type WorkspaceOption } from './NewProjectDialog.tsx'
import { ProjectMenu, useProjectActions } from './ProjectActions.tsx'
import { sameList } from './ProjectsPage.tsx'
import { type Live, threadsRevision, useLive, type UseStatus } from './threads.ts'

interface Anchor {
  nav: HTMLElement
  /** False while the sidebar is a rail of icons. */
  wide: boolean
}

let anchor: Anchor | null = null
const anchorListeners = new Set<() => void>()

function setAnchor(next: Anchor | null): void {
  if (next?.nav === anchor?.nav && next?.wide === anchor?.wide) return
  anchor = next
  for (const listener of anchorListeners) listener()
}

const subscribeAnchor = (listener: () => void) => {
  anchorListeners.add(listener)
  return () => { anchorListeners.delete(listener) }
}

/** For our "Projects" panel icon, which DSH renders inside the sidebar's panel <nav> (16px wide, 18px as a rail). */
export function useSidebarAnchor(size: number) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const nav = ref.current?.closest('nav')
    if (!(nav instanceof HTMLElement)) return
    setAnchor({ nav, wide: size < 18 })
    return () => { if (anchor?.nav === nav) setAnchor(null) }
  }, [size])
  return ref
}

interface WorkspaceSnapshot {
  items: readonly (WorkspaceOption & { sessionIds: readonly string[] })[]
  archivedSessionIds?: readonly string[]
}

export interface SidebarProjectsProps {
  t: Translate
  /** Standard props of root-scope slots. */
  useWorkspaces: <T>(selector: (snapshot: WorkspaceSnapshot) => T, equal?: (a: T, b: T) => boolean) => T
  useSessions: <T>(selector: (list: { byId: Record<string, (SessionSummary & { retainedBy?: { mainView?: number } }) | undefined> }) => T) => T
  useSessionStatus: UseStatus
  usePanelInfo: <T>(selector: (info: { activePanelId: string | null }) => T) => T
  /** Injected by src/client/index.tsx. */
  openSession: (sessionId: string) => void
  pinSession: (sessionId: string, pinned: boolean) => Promise<void>
  pickFolder: PickFolder
}

/** The session DSH highlights: the one its main view holds, unless a panel is open. */
function useCurrentSession(props: Pick<SidebarProjectsProps, 'useSessions' | 'usePanelInfo'>): string | undefined {
  const panelActive = props.usePanelInfo((info) => info.activePanelId !== null)
  const held = props.useSessions((list) => Object.entries(list.byId).find(([, session]) => (session?.retainedBy?.mainView ?? 0) > 0)?.[0])
  return panelActive ? undefined : held
}

/** Keep DSH's workspace list free of workspaces that would show nothing but project sessions. */
function useHideProjectWorkspaces(props: SidebarProjectsProps): void {
  const { mains, threads } = useKinds()
  const workspaces = props.useWorkspaces((snapshot) => snapshot.items)
  const archived = props.useWorkspaces((snapshot) => snapshot.archivedSessionIds)
  const sessions = props.useSessions((list) => list.byId)
  const current = useCurrentSession(props)
  useEffect(() => {
    setHiddenWorkspaces(projectOnlyWorkspaces(workspaces, sessions, new Set(archived ?? []), new Set([...mains.keys(), ...threads]), current))
  }, [workspaces, archived, sessions, mains, threads, current])
}

/**
 * The `shell.overlay` entry: keeps the section's container right after the panel <nav>, and the
 * workspace list free of project-only workspaces.
 */
export function SidebarProjectsHost(props: SidebarProjectsProps) {
  useHideProjectWorkspaces(props)
  const current = useSyncExternalStore(subscribeAnchor, () => anchor)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (current === null || !current.wide) {
      setContainer(null)
      return
    }
    const element = document.createElement('div')
    element.className = 'dsht-side'
    current.nav.after(element)
    setContainer(element)
    return () => { element.remove() }
  }, [current])
  return container === null ? null : createPortal(<SidebarProjects {...props} />, container)
}

const COLLAPSED_KEY = 'dsh-threads.sidebar.projects.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function SidebarProjects({ t, useWorkspaces, useSessions, useSessionStatus, usePanelInfo, openSession, pinSession, pickFolder }: SidebarProjectsProps) {
  const { projects } = useProjects()
  const { mains } = useKinds()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [expanded, setExpanded] = useState(false)
  const [creating, setCreating] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const { actions, dialogs } = useProjectActions({ projects, t, pinSession })
  const workspaces = useWorkspaces((snapshot) => snapshot.items, sameList)
  const live = useLive(useSessionStatus)
  const currentId = useCurrentSession({ useSessions, usePanelInfo })

  // Thread counts and activity change whenever a session starts or stops.
  useEffect(() => { void projectsStore.refresh() }, [live.key])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      // Not remembered; the section still toggles.
    }
  }

  const rows = sidebarProjects(projects)
  const shown = expanded ? rows : rows.slice(0, SIDEBAR_VISIBLE)

  return (
    <>
      <div className="dsht-side-head">
        <button type="button" className="dsht-side-label" aria-expanded={!collapsed} onClick={toggle}>
          <span>{t('side.title')}</span>
          <IconChevronDownOutlineRegular size={14} className={collapsed ? 'dsht-rotate' : undefined} />
        </button>
        <button type="button" className="dsht-side-icon" aria-label={t('page.new')} title={t('page.new')} onClick={() => setCreating(true)}>
          <PlusIcon size={16} />
        </button>
      </div>

      {collapsed ? null : (
        <div className="dsht-side-list" role="tree" aria-label={t('side.title')}>
          {rows.length === 0 ? (
            <button type="button" className="dsht-side-more" onClick={() => setCreating(true)}>{t('side.empty')}</button>
          ) : shown.map((project) => {
            const selected = currentId === project.mainSessionId
            const threads = mains.get(project.mainSessionId)?.threads ?? project.threads
            return (
              <div key={project.id} role="treeitem" aria-selected={selected} tabIndex={0}
                className={`dsht-side-row${selected ? ' is-selected' : ''}${menuFor === project.id ? ' is-menu-open' : ''}`}
                onClick={() => openSession(project.mainSessionId)}
                onKeyDown={(event) => { if (event.key === 'Enter' && event.target === event.currentTarget) openSession(project.mainSessionId) }}>
                <span className="dsht-side-slot">
                  <RowMark project={project} main={mains.get(project.mainSessionId)} live={live} t={t} />
                </span>
                <span className="dsht-side-title">{project.title}</span>
                <span className="dsht-side-meta">
                  {project.pinned ? <IconPinFillRegular size={14} /> : null}
                  {threads > 0 ? <span>↳ {threads}</span> : null}
                </span>
                <span className="dsht-side-actions" onClick={(event) => event.stopPropagation()}>
                  <ProjectMenu project={project} actions={actions} t={t} onOpenChange={(open) => setMenuFor(open ? project.id : null)} />
                </span>
              </div>
            )
          })}
          {rows.length > SIDEBAR_VISIBLE ? (
            <button type="button" className="dsht-side-more" onClick={() => setExpanded(!expanded)}>
              {expanded ? t('side.less') : t('side.more', { count: rows.length - SIDEBAR_VISIBLE })}
            </button>
          ) : null}
        </div>
      )}

      <NewProjectDialog
        open={creating}
        initialFolder={null}
        onClose={() => setCreating(false)}
        onCreated={(project) => { threadsRevision.bump(); openSession(project.mainSessionId) }}
        workspaces={workspaces}
        pickFolder={pickFolder}
        t={t}
      />
      {dialogs}
    </>
  )
}

/**
 * A raised hand when the main conversation or a thread waits on the user (a decision, an approval,
 * a question), a breathing dot while anything runs, else the project's icon.
 */
function RowMark({ project, main, live, t }: { project: ProjectView; main: MainKind | undefined; live: Live; t: Translate }) {
  const asking = [project.mainSessionId, ...(main?.threadIds ?? [])].filter((id) => live.asking.has(id)).length
  const waiting = (main?.waiting ?? 0) + asking
  const threadsRunning = main?.running ?? project.running
  if (waiting > 0) return <ThreadGlyph state="waiting" label={t('badge.waiting', { count: waiting })} />
  if (threadsRunning > 0) return <ThreadGlyph state="running" label={t('badge.running', { count: threadsRunning })} />
  if (live.running.has(project.mainSessionId)) return <ThreadGlyph state="running" label={t('side.mainRunning')} />
  return <span className="dsht-row-icon"><ProjectIcon id={project.icon} size={14} /></span>
}
