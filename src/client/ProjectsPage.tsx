// The "Projects" page (full-page `main` panel), modelled on Claude's projects page.
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useMemo, useState } from 'react'
import { callHost, projectsStore, type ProjectView, useProjects } from './api.ts'
import { FolderIcon, PinIcon, PlusIcon, SearchIcon, TrashIcon } from './icons.tsx'
import { relativeTime, type Translate } from './locale.ts'
import { NewProjectDialog, type WorkspaceOption } from './NewProjectDialog.tsx'
import { threadsRevision } from './threads.ts'

type Sort = 'activity' | 'created' | 'title'

export interface ProjectsPageProps {
  t: Translate
  /** Standard props of root-scope slots. */
  useWorkspaces: <T>(selector: (snapshot: { items: readonly WorkspaceOption[] }) => T, equal?: (a: T, b: T) => boolean) => T
  useSessionStatus: <T>(selector: (statuses: ReadonlyMap<string, { running: boolean }>) => T) => T
  /** Injected by src/client/index.tsx. */
  openSession: (sessionId: string) => void
  pinSession: (sessionId: string, pinned: boolean) => Promise<void>
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

export function ProjectsPage({ t, useWorkspaces, useSessionStatus, openSession, pinSession }: ProjectsPageProps) {
  const { status, projects, error } = useProjects()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('activity')
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<ProjectView | null>(null)
  const workspaces = useWorkspaces((snapshot) => snapshot.items, sameList)
  // Any session starting or stopping may change thread counts: reload then.
  const runningKey = useSessionStatus((statuses) =>
    [...statuses].filter(([, state]) => state.running).map(([id]) => id).sort().join(','))

  useEffect(() => { void projectsStore.refresh() }, [runningKey])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle.length === 0
      ? projects
      : projects.filter((p) => p.title.toLowerCase().includes(needle) || p.folder.toLowerCase().includes(needle))
    return sortProjects(matched, sort)
  }, [projects, query, sort])

  const togglePin = async (project: ProjectView) => {
    await callHost('projects.pin', { id: project.id, pinned: !project.pinned })
    await pinSession(project.mainSessionId, !project.pinned).catch(() => {})
    await projectsStore.refresh()
  }

  const remove = async (project: ProjectView) => {
    await callHost('projects.remove', { id: project.id })
    if (project.pinned) await pinSession(project.mainSessionId, false).catch(() => {})
    setRemoving(null)
    threadsRevision.bump()
    await projectsStore.refresh()
  }

  return (
    <div className="dsht-page">
      <div className="dsht-inner">
        <div className="dsht-head">
          <div>
            <h1 className="dsht-title">{t('page.title')}</h1>
            <p className="dsht-subtitle">{t('page.subtitle')}</p>
          </div>
          <div className="dsht-actions">
            <select className="dsht-select" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="activity">{t('page.sort.activity')}</option>
              <option value="created">{t('page.sort.created')}</option>
              <option value="title">{t('page.sort.title')}</option>
            </select>
            <Button variant="primary" icon={<PlusIcon size={14} />} onClick={() => setCreating(true)}>{t('page.new')}</Button>
          </div>
        </div>

        <div className="dsht-search">
          <SearchIcon size={16} />
          <input className="dsht-text" value={query} placeholder={t('page.search')} onChange={(event) => setQuery(event.target.value)} />
        </div>

        {status === 'error' && error !== null ? <div className="dsht-error">{t('page.loadFailed', { error })}</div> : null}

        {visible.length === 0
          ? (status === 'ready' ? <div className="dsht-empty">{projects.length === 0 ? t('page.empty') : t('page.noMatch')}</div> : null)
          : (
              <div className="dsht-grid">
                {visible.map((project) => (
                  <div
                    key={project.id}
                    className="dsht-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => openSession(project.mainSessionId)}
                    onKeyDown={(event) => { if (event.key === 'Enter') openSession(project.mainSessionId) }}
                  >
                    <span className="dsht-card-icon"><FolderIcon size={16} /></span>
                    <div className="dsht-card-title">
                      {project.title}
                      {project.pinned ? <PinIcon size={13} filled className="dsht-pinned" /> : null}
                    </div>
                    <div className="dsht-card-meta">
                      <span>{relativeTime(t, project.lastActivity)}</span>
                      <span>{t('card.threads', { count: project.threads })}</span>
                      {project.running > 0 ? <span className="dsht-running">{t('card.running', { count: project.running })}</span> : null}
                    </div>
                    <div className="dsht-card-folder" title={project.folder}>{project.folder}</div>
                    <div className="dsht-card-tools" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className={`dsht-icon-button ${project.pinned ? '' : 'dsht-hover-only'}`}
                        title={project.pinned ? t('card.unpin') : t('card.pin')} aria-label={project.pinned ? t('card.unpin') : t('card.pin')}
                        onClick={() => { void togglePin(project) }}>
                        <PinIcon size={14} filled={project.pinned} />
                      </button>
                      <button type="button" className="dsht-icon-button dsht-hover-only"
                        title={t('card.remove')} aria-label={t('card.remove')} onClick={() => setRemoving(project)}>
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>

      <NewProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(project) => { setCreating(false); threadsRevision.bump(); openSession(project.mainSessionId) }}
        workspaces={workspaces}
        t={t}
      />

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing === null ? '' : t('remove.title', { title: removing.title })}
        description={t('remove.description')}
        closeLabel={t('common.close')}
        footer={(
          <div className="dsht-buttons">
            <Button variant="ghost" onClick={() => setRemoving(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={() => { if (removing !== null) void remove(removing) }}>{t('remove.confirm')}</Button>
          </div>
        )}
      />
    </div>
  )
}
