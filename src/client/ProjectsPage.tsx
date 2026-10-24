// The "Projects" page (full-page `main` panel), modelled on Claude's projects page: a sort menu,
// a split "New project" button, and cards with the project's "⋮" menu (ProjectActions.tsx).
import {
  Button,
  IconChevronDownOutlineRegular,
  IconPinFillRegular,
  Menu,
  type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useMemo, useState } from 'react'
import { projectsStore, type ProjectView, useProjects } from './api.ts'
import { FolderIcon, PlusIcon, ProjectIcon, SearchIcon } from './icons.tsx'
import { type MessageKey, relativeTime, type Translate } from './locale.ts'
import { NewProjectDialog, type PickFolder, type WorkspaceOption } from './NewProjectDialog.tsx'
import { type ProjectActions, ProjectMenu, useProjectActions } from './ProjectActions.tsx'
import { threadsRevision } from './threads.ts'

type Sort = 'activity' | 'created' | 'title'

const SORT_LABELS: Record<Sort, MessageKey> = { activity: 'page.sort.activity', created: 'page.sort.created', title: 'page.sort.title' }

export interface ProjectsPageProps {
  t: Translate
  /** Standard props of root-scope slots. */
  useWorkspaces: <T>(selector: (snapshot: { items: readonly WorkspaceOption[] }) => T, equal?: (a: T, b: T) => boolean) => T
  useSessionStatus: <T>(selector: (statuses: ReadonlyMap<string, { running: boolean }>) => T) => T
  /** Injected by src/client/index.tsx. */
  openSession: (sessionId: string) => void
  pinSession: (sessionId: string, pinned: boolean) => Promise<void>
  pickFolder: PickFolder
  /** Bring this page back: DSH leaves it when the session it considers current gets archived. */
  showProjects: () => void
}

export const sameList = (a: readonly WorkspaceOption[], b: readonly WorkspaceOption[]) =>
  a.length === b.length && a.every((item, index) => item.workspaceId === b[index]?.workspaceId && item.title === b[index]?.title)

export function sortProjects(projects: readonly ProjectView[], sort: Sort): ProjectView[] {
  const key = (p: ProjectView) => (sort === 'created' ? p.createdAt : p.lastActivity)
  return [...projects].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (sort === 'title') return a.title.localeCompare(b.title)
    return key(b).localeCompare(key(a))
  })
}

export function ProjectsPage({ t, useWorkspaces, useSessionStatus, openSession, pinSession, pickFolder, showProjects }: ProjectsPageProps) {
  const { status, projects, error } = useProjects()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('activity')
  const [sortOpen, setSortOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [creating, setCreating] = useState<{ folder: string | null } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const { actions, dialogs, error: actionError } = useProjectActions({ projects, t, pinSession, afterArchive: showProjects })
  const workspaces = useWorkspaces((snapshot) => snapshot.items, sameList)
  // Any session starting or stopping may change thread counts: reload then.
  const runningKey = useSessionStatus((statuses) =>
    [...statuses].filter(([, state]) => state.running).map(([id]) => id).sort().join(','))

  useEffect(() => { void projectsStore.refresh() }, [runningKey])

  const { active, archived } = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle.length === 0
      ? projects
      : projects.filter((p) => p.title.toLowerCase().includes(needle) || p.folder.toLowerCase().includes(needle))
    const sorted = sortProjects(matched, sort)
    return { active: sorted.filter((p) => !p.archived), archived: sorted.filter((p) => p.archived) }
  }, [projects, query, sort])

  const newFromItems: MenuEntry[] = [
    { type: 'label', id: 'from', text: t('page.newFrom') },
    ...workspaces.map((workspace) => ({ id: workspace.workspaceId, label: workspace.title, icon: <FolderIcon size={16} /> })),
  ]

  return (
    <div className="dsht-page">
      <div className="dsht-inner">
        <div className="dsht-head">
          <h1 className="dsht-title">{t('page.title')}</h1>
          <div className="dsht-actions">
            <Menu open={sortOpen} onClose={() => setSortOpen(false)} align="end" portal selection="check" selectedId={sort}
              items={(['activity', 'created', 'title'] as const).map((id) => ({ id, label: t(SORT_LABELS[id]) }))}
              onSelect={(id) => { setSort(id as Sort); setSortOpen(false) }}
              anchor={(
                <button type="button" className="dsht-select-button" aria-haspopup="menu" aria-expanded={sortOpen} onClick={() => setSortOpen(!sortOpen)}>
                  <span className="dsht-select-label">{t('page.sortBy')}</span>
                  <span>{t(SORT_LABELS[sort])}</span>
                  <IconChevronDownOutlineRegular size={14} />
                </button>
              )} />
            <div className="dsht-split">
              <Button variant="primary" icon={<PlusIcon size={14} />} onClick={() => setCreating({ folder: null })}>{t('page.new')}</Button>
              {workspaces.length === 0 ? null : (
                <Menu open={newOpen} onClose={() => setNewOpen(false)} align="end" portal items={newFromItems}
                  onSelect={(id) => {
                    setNewOpen(false)
                    const workspace = workspaces.find((item) => item.workspaceId === id)
                    if (workspace !== undefined) setCreating({ folder: workspace.path })
                  }}
                  anchor={(
                    <Button variant="primary" className="dsht-split-more" aria-label={t('page.newFrom')} aria-haspopup="menu" aria-expanded={newOpen}
                      onClick={() => setNewOpen(!newOpen)} icon={<IconChevronDownOutlineRegular size={14} />} />
                  )} />
              )}
            </div>
          </div>
        </div>

        <div className="dsht-search">
          <SearchIcon size={16} />
          <input className="dsht-text" value={query} placeholder={t('page.search')} onChange={(event) => setQuery(event.target.value)} />
        </div>

        {status === 'error' && error !== null ? <div className="dsht-error">{t('page.loadFailed', { error })}</div> : null}
        {actionError === null ? null : <div className="dsht-error">{actionError}</div>}

        {active.length === 0
          ? (status === 'ready' ? <div className="dsht-empty">{projects.length === 0 ? t('page.empty') : t('page.noMatch')}</div> : null)
          : <div className="dsht-grid">{active.map((project) => <ProjectCard key={project.id} project={project} actions={actions} openSession={openSession} t={t} />)}</div>}

        {archived.length === 0 ? null : (
          <section className="dsht-archived">
            <button type="button" className="dsht-archived-toggle" aria-expanded={showArchived} onClick={() => setShowArchived(!showArchived)}>
              <IconChevronDownOutlineRegular size={14} className={showArchived ? '' : 'dsht-rotate'} />
              {t('page.archived', { count: archived.length })}
            </button>
            {showArchived
              ? <div className="dsht-grid">{archived.map((project) => <ProjectCard key={project.id} project={project} actions={actions} openSession={openSession} t={t} />)}</div>
              : null}
          </section>
        )}
      </div>

      <NewProjectDialog
        open={creating !== null}
        initialFolder={creating?.folder ?? null}
        onClose={() => setCreating(null)}
        onCreated={(project) => { threadsRevision.bump(); openSession(project.mainSessionId) }}
        workspaces={workspaces}
        pickFolder={pickFolder}
        t={t}
      />

      {dialogs}
    </div>
  )
}

function ProjectCard({ project, actions, openSession, t }: {
  project: ProjectView
  actions: ProjectActions
  openSession: (sessionId: string) => void
  t: Translate
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const open = () => { if (!project.archived) openSession(project.mainSessionId) }

  return (
    <div className={`dsht-project${menuOpen ? ' is-menu-open' : ''}${project.archived ? ' is-archived' : ''}`} role="button" tabIndex={0}
      onClick={open} onKeyDown={(event) => { if (event.key === 'Enter' && event.target === event.currentTarget) open() }}>
      <div className="dsht-project-top">
        <span className="dsht-project-icon"><ProjectIcon id={project.icon} size={16} /></span>
        <div className="dsht-project-tools" onClick={(event) => event.stopPropagation()}>
          <ProjectMenu project={project} actions={actions} t={t} onOpenChange={setMenuOpen} />
        </div>
      </div>
      <div className="dsht-project-title">
        <span className="dsht-project-name">{project.title}</span>
        {project.pinned ? <IconPinFillRegular size={14} className="dsht-pin-on" /> : null}
      </div>
      <div className="dsht-project-meta">
        <span>{relativeTime(t, project.lastActivity)}</span>
        {project.threads > 0 ? <span>{t('card.threads', { count: project.threads })}</span> : null}
        {project.running > 0 ? <span className="dsht-running"><span className="dsht-pulse" />{t('card.running', { count: project.running })}</span> : null}
      </div>
    </div>
  )
}
