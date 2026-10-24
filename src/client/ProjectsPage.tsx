// The "Projects" page (full-page `main` panel), modelled on Claude's projects page: a sort menu,
// a split "New project" button, and cards whose "⋮" menu pins, sets notifications, opens the
// project settings, archives and deletes (with Claude's single-key shortcuts while it is open).
import {
  Button,
  IconArchiveOutlineRegular,
  IconCheckOutlineRegular,
  IconChevronDownOutlineRegular,
  IconEllipsisOutlineRegular,
  IconPinFillRegular,
  IconPinOutlineRegular,
  IconSettingsOutlineRegular,
  IconTrashOutlineRegular,
  IconUnarchiveOutlineRegular,
  Menu,
  type MenuEntry,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useMemo, useState } from 'react'
import { callHost, type NotifyLevel, projectsStore, type ProjectView, useProjects } from './api.ts'
import { BellIcon, FolderIcon, PlusIcon, ProjectIcon, SearchIcon } from './icons.tsx'
import { type MessageKey, relativeTime, type Translate } from './locale.ts'
import { NewProjectDialog, type PickFolder, type WorkspaceOption } from './NewProjectDialog.tsx'
import { ProjectSettings } from './ProjectSettings.tsx'
import { threadsRevision } from './threads.ts'

type Sort = 'activity' | 'created' | 'title'

const SORT_LABELS: Record<Sort, MessageKey> = { activity: 'page.sort.activity', created: 'page.sort.created', title: 'page.sort.title' }
const NOTIFY_LEVELS: readonly NotifyLevel[] = ['all', 'attention', 'waiting', 'none']

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

const sameList = (a: readonly WorkspaceOption[], b: readonly WorkspaceOption[]) =>
  a.length === b.length && a.every((item, index) => item.workspaceId === b[index]?.workspaceId && item.title === b[index]?.title)

function sortProjects(projects: readonly ProjectView[], sort: Sort): ProjectView[] {
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
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ProjectView | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
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

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await action()
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      threadsRevision.bump()
      await projectsStore.refresh()
    }
  }

  const actions: CardActions = {
    togglePin: (project) => run(async () => {
      await callHost('projects.pin', { id: project.id, pinned: !project.pinned })
      await pinSession(project.mainSessionId, !project.pinned).catch(() => {})
    }),
    setNotify: (project, notify) => run(() => callHost('projects.update', { id: project.id, notify })),
    openSettings: (project) => setSettingsId(project.id),
    toggleArchive: (project) => run(async () => {
      await callHost(project.archived ? 'projects.unarchive' : 'projects.archive', { id: project.id })
      setTimeout(showProjects, 120)
    }),
    askDelete: (project) => setDeleting(project),
  }

  const remove = (project: ProjectView) => run(async () => {
    setDeleting(null)
    await callHost('projects.remove', { id: project.id })
    if (project.pinned) await pinSession(project.mainSessionId, false).catch(() => {})
  })

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

      <ProjectSettings project={projects.find((p) => p.id === settingsId) ?? null} open={settingsId !== null} onClose={() => setSettingsId(null)} t={t} />

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting === null ? '' : t('delete.title', { title: deleting.title })}
        description={t('delete.description')}
        closeLabel={t('common.close')}
        footer={(
          <div className="dsht-buttons">
            <Button variant="ghost" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" className="dsht-danger" onClick={() => { if (deleting !== null) void remove(deleting) }}>{t('delete.confirm')}</Button>
          </div>
        )}
      />
    </div>
  )
}

interface CardActions {
  togglePin: (project: ProjectView) => Promise<void>
  setNotify: (project: ProjectView, level: NotifyLevel) => Promise<void>
  openSettings: (project: ProjectView) => void
  toggleArchive: (project: ProjectView) => Promise<void>
  askDelete: (project: ProjectView) => void
}

const SHORTCUTS: Record<string, 'pin' | 'settings' | 'archive' | 'delete'> = { p: 'pin', s: 'settings', a: 'archive', d: 'delete' }

function ProjectCard({ project, actions, openSession, t }: {
  project: ProjectView
  actions: CardActions
  openSession: (sessionId: string) => void
  t: Translate
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const act = (id: string) => {
    setMenuOpen(false)
    if (id === 'pin') void actions.togglePin(project)
    else if (id === 'settings') actions.openSettings(project)
    else if (id === 'archive') void actions.toggleArchive(project)
    else if (id === 'delete') actions.askDelete(project)
    else if (id.startsWith('notify:')) void actions.setNotify(project, id.slice('notify:'.length) as NotifyLevel)
  }

  // Claude's menu takes single keys while it is open: P pin, S settings, A archive, D delete.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const id = SHORTCUTS[event.key.toLowerCase()]
      if (id === undefined || (id === 'pin' && project.archived)) return
      event.preventDefault()
      event.stopPropagation()
      act(id)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, project])

  const items: MenuEntry[] = [
    ...(project.archived ? [] : [{
      id: 'pin',
      label: project.pinned ? t('menu.unpin') : t('menu.pin'),
      icon: project.pinned ? <IconPinFillRegular size={16} /> : <IconPinOutlineRegular size={16} />,
      shortcut: { keys: ['P'] },
    }]),
    {
      id: 'notify',
      label: <span className="dsht-menu-aside-row"><span>{t('menu.notify')}</span><span className="dsht-menu-aside">{t(`notify.${project.notify}.short`)}</span></span>,
      icon: <BellIcon size={16} />,
      submenu: NOTIFY_LEVELS.map((level) => ({
        id: `notify:${level}`,
        icon: project.notify === level ? <IconCheckOutlineRegular size={16} /> : <span className="dsht-menu-icon-space" />,
        label: <span className="dsht-menu-two"><span>{t(`notify.${level}`)}</span><span className="dsht-menu-sub">{t(`notify.${level}.hint`)}</span></span>,
      })),
    },
    { id: 'settings', label: t('menu.settings'), icon: <IconSettingsOutlineRegular size={16} />, shortcut: { keys: ['S'] } },
    { type: 'separator', id: 'separator' },
    {
      id: 'archive',
      label: project.archived ? t('menu.unarchive') : t('menu.archive'),
      icon: project.archived ? <IconUnarchiveOutlineRegular size={16} /> : <IconArchiveOutlineRegular size={16} />,
      shortcut: { keys: ['A'] },
    },
    { id: 'delete', label: t('menu.delete'), icon: <IconTrashOutlineRegular size={16} />, danger: true, shortcut: { keys: ['D'] } },
  ]

  const open = () => { if (!project.archived) openSession(project.mainSessionId) }

  return (
    <div className={`dsht-project${menuOpen ? ' is-menu-open' : ''}${project.archived ? ' is-archived' : ''}`} role="button" tabIndex={0}
      onClick={open} onKeyDown={(event) => { if (event.key === 'Enter' && event.target === event.currentTarget) open() }}>
      <div className="dsht-project-top">
        <span className="dsht-project-icon"><ProjectIcon id={project.icon} size={16} /></span>
        <div className="dsht-project-tools" onClick={(event) => event.stopPropagation()}>
          <Menu open={menuOpen} onClose={() => setMenuOpen(false)} align="end" portal items={items} onSelect={act}
            anchor={(
              <button type="button" className="dsht-icon-button" aria-label={t('menu.more')} title={t('menu.more')}
                aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
                <IconEllipsisOutlineRegular size={16} />
              </button>
            )} />
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
