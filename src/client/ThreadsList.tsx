// The thread list (right-sidebar "Threads" tab) and the conversation-header entry that opens it.
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { useMemo } from 'react'
import { ThreadsIcon } from './icons.tsx'
import { relativeTime, type Translate } from './locale.ts'
import { dotState, type SessionRole, type ThreadView, useHostValue, useThreadsRevision } from './threads.ts'

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
  if (role === undefined) return null
  if (role.project === null) return <div className="dsht-tab">{t('list.notProject')}</div>

  return (
    <div className="dsht-list">
      <div className="dsht-list-head">
        <span>{role.project.title}</span>
        {role.thread ? <Button size="sm" variant="ghost" onClick={() => openSession(role.project!.mainSessionId)}>{t('header.backToMain')}</Button> : null}
      </div>
      {threads === undefined ? null : threads.length === 0
        ? <div className="dsht-tab">{t('list.empty')}</div>
        : threads.map((thread) => (
            <button key={thread.id} type="button" className="dsht-row" onClick={() => openThread(thread.id)}>
              <StateDot state={dotState(thread, running.has(thread.id))} className="dsht-dot" />
              <span className="dsht-row-body">
                <span className="dsht-row-title">#{thread.n} {thread.title}</span>
                <span className="dsht-row-summary">{thread.lastReport?.summary ?? thread.error ?? t('list.noReport')}</span>
                <span className="dsht-row-meta">
                  {relativeTime(t, thread.updatedAt)}{thread.resolved ? ` · ${t('list.resolved')}` : ''}
                </span>
              </span>
            </button>
          ))}
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
  const count = threads?.length ?? 0
  const active = threads?.filter((thread) => thread.status === 'running' || thread.status === 'starting').length ?? 0
  return (
    <Button size="sm" variant="ghost" icon={<ThreadsIcon size={14} />} onClick={openThreadsList}>
      {t('header.threads', { count })}{active > 0 ? ` · ${t('header.running', { count: active })}` : ''}
    </Button>
  )
}
