// The thread list (right-sidebar "Threads" tab) and the conversation-header entry that opens it.
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { useMemo, useState } from 'react'
import { type GlyphState, glyphState, ThreadGlyph } from './glyphs.tsx'
import { SearchIcon, ThreadsIcon } from './icons.tsx'
import { relativeTime, type Translate } from './locale.ts'
import { groupThreads, type SessionRole, type ThreadView, useHostValue, useThreadsRevision } from './threads.ts'
import { BranchChip, ChevronIcon, FileIcon, Pill } from './ui.tsx'

type UseStatus = <T>(selector: (statuses: ReadonlyMap<string, { running?: boolean }>) => T) => T

const runningIds = (statuses: ReadonlyMap<string, { running?: boolean }>) =>
  [...statuses].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(',')

/** The project main conversation a session belongs to (itself, or the main of its thread). */
function useProjectMain(sessionId: string | undefined, revision: number) {
  const role = useHostValue<SessionRole>(sessionId === undefined ? null : 'sessions.role', { id: sessionId }, [sessionId, revision])
  return { role, mainSessionId: role?.project?.mainSessionId }
}

function useThreads(mainSessionId: string | undefined, useSessionStatus: UseStatus, revision: number) {
  const running = useSessionStatus(runningIds)
  return useHostValue<ThreadView[]>(mainSessionId === undefined ? null : 'threads.list', { mainSessionId }, [mainSessionId, running, revision])
}

type SectionId = 'waiting' | 'running' | 'idle' | 'resolved' | 'archived'

/**
 * The right-sidebar threads list, after Claude's threads panel: a title with search, then
 * sections (waiting for you, running, idle, resolved, archived) with counts, each foldable.
 * "Waiting" and "resolved" always show, with a dashed placeholder when empty.
 */
export function ThreadsListTab({ sessionId, useSessionStatus, t, openThread, openSession }: {
  sessionId: string
  useSessionStatus: UseStatus
  t: Translate
  openThread: (threadId: string) => void
  openSession: (sessionId: string) => void
}) {
  const revision = useThreadsRevision()
  const { role, mainSessionId } = useProjectMain(sessionId, revision)
  const threads = useThreads(mainSessionId, useSessionStatus, revision)
  // Selectors must return stable values: select the joined ids, derive the set here.
  const runningKey = useSessionStatus(runningIds)
  const running = useMemo(() => new Set(runningKey.split(',')), [runningKey])
  // null: the search field is closed.
  const [query, setQuery] = useState<string | null>(null)
  const [folded, setFolded] = useState<Partial<Record<SectionId, boolean>>>({ archived: true })
  if (role === undefined) return null
  if (role.project === null) return <div className="dsht-tab">{t('list.notProject')}</div>
  const groups = groupThreads(threads ?? [], (thread) => glyphState(thread, running.has(thread.id)), query ?? '')
  const searching = (query ?? '').trim().length > 0
  const nothing = searching && Object.values(groups).every((list) => list.length === 0)

  const section = (id: SectionId, label: string, list: readonly ThreadView[], empty?: string) => {
    // Searching shows only the sections with matches.
    if (list.length === 0 && (empty === undefined || searching)) return null
    const open = list.length > 0 && folded[id] !== true
    return (
      <section key={id} className={`dsht-section dsht-section-${id}`}>
        <button type="button" className={`dsht-section-head${open ? ' is-open' : ''}`} aria-expanded={open} disabled={list.length === 0}
          onClick={() => setFolded((current) => ({ ...current, [id]: open }))}>
          <span>{label} · {list.length}</span>
          {list.length === 0 ? null : <ChevronIcon />}
        </button>
        {list.length === 0
          ? <div className="dsht-section-empty">{empty}</div>
          : open ? <div className="dsht-rows">{list.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} state={glyphState(thread, running.has(thread.id))} t={t} onOpen={() => openThread(thread.id)} />
            ))}</div> : null}
      </section>
    )
  }

  return (
    <div className="dsht-list">
      <div className="dsht-list-top">
        <span className="dsht-list-title">{t('list.title')}</span>
        <div className="dsht-list-tools">
          {role.thread ? <Button size="sm" variant="ghost" onClick={() => openSession(role.project!.mainSessionId)}>{t('header.backToMain')}</Button> : null}
          <Pill icon={<SearchIcon size={15} />} label={t('list.search')} onClick={() => setQuery((current) => (current === null ? '' : null))} />
        </div>
      </div>
      {query === null ? null : (
        <input className="dsht-list-search" autoFocus value={query} placeholder={t('list.search')} aria-label={t('list.search')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') setQuery(null) }} />
      )}
      {threads === undefined ? null : nothing ? <div className="dsht-tab">{t('list.noMatch')}</div> : (
        <>
          {section('waiting', t('list.waiting'), groups.waiting, t('list.waitingEmpty'))}
          {section('running', t('list.running'), groups.running)}
          {section('idle', t('list.idle'), groups.idle)}
          {section('resolved', t('list.resolvedSection'), groups.resolved, t('list.resolvedEmpty'))}
          {section('archived', t('list.archivedSection'), groups.archived)}
        </>
      )}
    </div>
  )
}

/** One thread in the list: state mark, number and title, time; what it waits on; its files and branch. */
function ThreadRow({ thread, state, t, onOpen }: { thread: ThreadView; state: GlyphState; t: Translate; onOpen: () => void }) {
  const report = thread.lastReport
  const files = report?.changedFiles ?? []
  const branch = thread.worktree === null || thread.worktree.removed ? undefined : thread.worktree.branch
  const decision = state === 'waiting' ? report?.decisions[0] ?? report?.summary : undefined
  return (
    <div className={`dsht-row dsht-row-${state}`} role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}>
      <ThreadGlyph state={state} />
      <div className="dsht-row-body">
        <div className="dsht-row-top">
          <span className="dsht-row-title"><span className="dsht-item-n">#{thread.n}</span>{thread.title}</span>
          <span className="dsht-row-time">{relativeTime(t, thread.updatedAt)}</span>
        </div>
        {decision === undefined || decision.length === 0 ? null : <div className="dsht-row-decision">{decision}</div>}
        {files.length === 0 && branch === undefined ? null : (
          <div className="dsht-row-chips">
            {files.length === 0 ? null : (
              <span className="dsht-chip dsht-count" title={files.join('\n')} aria-label={t('list.files', { count: files.length })}>
                <FileIcon kind="doc" />{files.length}
              </span>
            )}
            {branch === undefined ? null : <BranchChip branch={branch} />}
          </div>
        )}
      </div>
    </div>
  )
}

/** Conversation header: "讨论串 · N" in a project main conversation, "主对话" in a thread. */
export function ThreadsHeaderAction({ sessionId, useSessionStatus, t, openThreadsList, openSession }: {
  sessionId: string | undefined
  useSessionStatus: UseStatus
  t: Translate
  openThreadsList: () => void
  openSession: (sessionId: string) => void
}) {
  const revision = useThreadsRevision()
  const { role, mainSessionId } = useProjectMain(sessionId, revision)
  const isMain = mainSessionId !== undefined && mainSessionId === sessionId
  const threads = useThreads(isMain ? mainSessionId : undefined, useSessionStatus, revision)
  if (role === undefined || role.project === null) return null
  if (role.thread) {
    const main = role.project.mainSessionId
    return <Button size="sm" variant="ghost" onClick={() => openSession(main)}>{t('header.backToMain')}</Button>
  }
  if (!isMain) return null
  const count = threads?.filter((thread) => !thread.archived).length ?? 0
  const active = threads?.filter((thread) => thread.status === 'running' || thread.status === 'starting').length ?? 0
  const waiting = threads?.filter((thread) => glyphState(thread) === 'waiting').length ?? 0
  const mark = waiting > 0 ? <ThreadGlyph state="waiting" /> : active > 0 ? <ThreadGlyph state="running" /> : <ThreadsIcon size={14} />
  return (
    <Button size="sm" variant="ghost" icon={mark} onClick={openThreadsList}>
      {t('header.threads', { count })}
      {waiting > 0 ? ` · ${t('header.waiting', { count: waiting })}` : active > 0 ? ` · ${t('header.running', { count: active })}` : ''}
    </Button>
  )
}
