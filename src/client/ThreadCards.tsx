// Thread cards in the transcript, modelled on Claude's: the notice that replaces "收到执行请求",
// and the turn-tail "↳ N 条回复" card listing the threads a turn opened.
import { useState } from 'react'
import type { NoticeData } from './chat.ts'
import { OPENED_KEY } from './chat.ts'
import { glyphState, reportGlyph } from './glyphs.tsx'
import { ThreadsIcon } from './icons.tsx'
import type { MessageKey, Translate } from './locale.ts'
import { type ThreadCardInfo, type ThreadView, useHostValue, useLive, type UseStatus, useThreadsRevision } from './threads.ts'
import { CardHead, RepliesIcon, ThreadItem } from './ui.tsx'


export const STATUS_KEYS: Record<string, MessageKey> = {
  done: 'status.done',
  blocked: 'status.blocked',
  needs_decision: 'status.needsDecision',
  failed: 'status.failed',
  'no-report': 'status.noReport',
  stopped: 'status.stopped',
}

/** Threads that wait on the user lead a report card. */
function waitingFirst(cards: readonly ThreadCardInfo[]): ThreadCardInfo[] {
  const waiting = (card: ThreadCardInfo) => (reportGlyph(card.status) === 'waiting' ? 0 : 1)
  return [...cards].sort((a, b) => waiting(a) - waiting(b))
}

/** conversation.chat.node renderer for NOTICE_NODE. */
export function NoticeCard({ node, sessionId, useSessionStatus, t, openThread }: {
  node: { data: NoticeData }
  sessionId: string
  useSessionStatus: UseStatus
  t: Translate
  openThread: (threadId: string) => void
}) {
  const { role, threads, summary, text } = node.data
  const [expanded, setExpanded] = useState(false)

  if (role === 'report' && threads.length > 0) {
    return <ReportCard cards={threads} sessionId={sessionId} useSessionStatus={useSessionStatus} t={t} openThread={openThread} />
  }

  // A brief or a follow-up, shown inside the thread; or an older notice without card data.
  const card = threads[0]
  const heading = role === 'brief' ? t('notice.brief') : role === 'reply' ? t('notice.reply') : role === 'reminder' ? t('notice.reminder') : summary
  const body = text.split('\n').filter((line, index) => !(index === 0 && line.startsWith('['))).join('\n').trim()
  return (
    <div className="dsht-card dsht-brief">
      <CardHead icon={<ThreadsIcon size={14} />} trailing={card?.branch === undefined ? undefined : <span className="dsht-mono">{card.branch}</span>}>
        {heading}{card === undefined ? '' : ` · #${card.n} ${card.title}`}
      </CardHead>
      {body.length === 0 ? null : (
        <button type="button" className={`dsht-brief-text${expanded ? '' : ' dsht-clamped'}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {body}
        </button>
      )}
    </div>
  )
}

/**
 * A report as delivered (its summary, files and branch), with each thread's current state, as
 * Claude's cards stay live: a thread resolved since then no longer shows a raised hand.
 */
function ReportCard({ cards, sessionId, useSessionStatus, t, openThread }: {
  cards: readonly ThreadCardInfo[]
  sessionId: string
  useSessionStatus: UseStatus
  t: Translate
  openThread: (threadId: string) => void
}) {
  const revision = useThreadsRevision()
  const live = useLive(useSessionStatus)
  const threads = useHostValue<ThreadView[]>('threads.list', { mainSessionId: sessionId }, [sessionId, live.key, revision])
  const byId = new Map((threads ?? []).map((thread) => [thread.id, thread]))
  return (
    <div className="dsht-card">
      <CardHead icon={<ThreadsIcon size={14} />}>{t('notice.report', { count: cards.length })}</CardHead>
      <div className="dsht-items">
        {waitingFirst(cards).map((card) => {
          const thread = byId.get(card.threadId)
          const state = thread === undefined ? reportGlyph(card.status) : glyphState(thread, live.running.has(card.threadId), live.asking.has(card.threadId))
          const status = state === 'running' ? t('status.running') : state === 'resolved' ? t('list.resolved')
            : t(STATUS_KEYS[thread?.lastReport?.status ?? card.status ?? 'no-report'] ?? 'status.noReport')
          return (
            <ThreadItem key={card.threadId} n={card.n} title={card.title} state={state} status={status}
              summary={card.summary} decision={state === 'waiting' ? card.decision : undefined} decisionLabel={t('card.decision')}
              files={card.files} branch={card.branch} openLabel={t('card.open')} onOpen={() => openThread(card.threadId)} />
          )
        })}
      </div>
    </div>
  )
}

/** conversation.chat.turnTail entry: the threads this turn opened ("↳ N 条回复"), with live state. */
export function TurnThreadsCard({ turn, sessionId, useSessionStatus, t, openThread }: {
  turn: { data: { get(key: string): unknown } }
  sessionId: string
  useSessionStatus: UseStatus
  t: Translate
  openThread: (threadId: string) => void
}) {
  const opened = (turn.data.get(OPENED_KEY) as { opened?: ThreadCardInfo[] } | undefined)?.opened ?? []
  const revision = useThreadsRevision()
  const live = useLive(useSessionStatus)
  const threads = useHostValue<ThreadView[]>(opened.length === 0 ? null : 'threads.list', { mainSessionId: sessionId }, [sessionId, live.key, revision])
  if (opened.length === 0) return null
  const byId = new Map((threads ?? []).map((thread) => [thread.id, thread]))
  return (
    <div className="dsht-card dsht-replies">
      <CardHead icon={<RepliesIcon />}>{t('card.replies', { count: opened.length })}</CardHead>
      <div className="dsht-items">
        {opened.map((card) => {
          const thread = byId.get(card.threadId)
          const state = thread === undefined ? 'running' : glyphState(thread, live.running.has(card.threadId), live.asking.has(card.threadId))
          const report = thread?.lastReport ?? null
          const status = state === 'running' ? t('status.running') : state === 'resolved' ? t('list.resolved')
            : report === null ? undefined : t(STATUS_KEYS[report.status] ?? 'status.noReport')
          return (
            // Compact, like Claude's inline thread cards: the report card carries the details.
            <ThreadItem key={card.threadId} compact n={card.n} title={card.title} state={state} status={status}
              files={state === 'running' ? undefined : report?.changedFiles.slice(0, 2)}
              branch={thread?.worktree?.branch ?? card.branch} openLabel={t('card.open')} onOpen={() => openThread(card.threadId)} />
          )
        })}
      </div>
    </div>
  )
}
