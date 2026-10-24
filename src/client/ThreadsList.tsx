// The thread list (right-sidebar "Threads" tab) and the conversation-header entry that opens it.
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { useMemo, useState } from 'react'
import { glyphState, ThreadGlyph } from './glyphs.tsx'
import { ThreadsIcon } from './icons.tsx'
import { relativeTime, type Translate } from './locale.ts'
import { STATUS_KEYS } from './ThreadCards.tsx'
import { type SessionRole, type ThreadView, useHostValue, useThreadsRevision } from './threads.ts'
import { ChevronIcon, ThreadItem } from './ui.tsx'

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
  const [showArchived, setShowArchived] = useState(false)
  if (role === undefined) return null
  if (role.project === null) return <div className="dsht-tab">{t('list.notProject')}</div>
  const active = threads?.filter((thread) => !thread.archived) ?? []
  const archived = threads?.filter((thread) => thread.archived) ?? []
  const item = (thread: ThreadView) => {
    const state = glyphState(thread, running.has(thread.id))
    const report = thread.lastReport
    const status = thread.archived ? t('pane.archived') : state === 'running' ? t('status.running') : state === 'resolved' ? t('list.resolved')
      : report === null ? t('list.noReport') : t(STATUS_KEYS[report.status] ?? 'status.noReport')
    return (
      <ThreadItem key={thread.id} n={thread.n} title={thread.title} state={state}
        status={`${status} · ${relativeTime(t, thread.updatedAt)}`}
        summary={state === 'running' ? undefined : report?.summary ?? thread.error ?? undefined}
        decision={state === 'waiting' ? report?.decisions[0] : undefined} decisionLabel={t('card.decision')}
        branch={thread.worktree === null || thread.worktree.removed ? undefined : thread.worktree.branch}
        openLabel={t('card.open')} onOpen={() => openThread(thread.id)} />
    )
  }

  return (
    <div className="dsht-list">
      <div className="dsht-list-head">
        <span>{role.project.title}</span>
        {role.thread ? <Button size="sm" variant="ghost" onClick={() => openSession(role.project!.mainSessionId)}>{t('header.backToMain')}</Button> : null}
      </div>
      {threads === undefined ? null : active.length === 0 && archived.length === 0
        ? <div className="dsht-tab">{t('list.empty')}</div>
        : <div className="dsht-items">{sortForList(active, running).map(item)}</div>}
      {archived.length === 0 ? null : (
        <>
          <button type="button" className={`dsht-list-fold${showArchived ? ' is-open' : ''}`} aria-expanded={showArchived}
            onClick={() => setShowArchived((open) => !open)}>
            <ChevronIcon />{t('list.archived', { count: archived.length })}
          </button>
          {showArchived ? <div className="dsht-items dsht-items-archived">{[...archived].sort((a, b) => b.n - a.n).map(item)}</div> : null}
        </>
      )}
    </div>
  )
}

/** Waiting on the user first, then running, then the rest; resolved threads last; newest first within each. */
function sortForList(threads: readonly ThreadView[], running: ReadonlySet<string>): ThreadView[] {
  const rank = (thread: ThreadView) => {
    const state = glyphState(thread, running.has(thread.id))
    return state === 'waiting' ? 0 : state === 'running' ? 1 : state === 'resolved' ? 3 : 2
  }
  return [...threads].sort((a, b) => rank(a) - rank(b) || b.n - a.n)
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
