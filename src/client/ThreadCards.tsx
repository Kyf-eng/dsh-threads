// Thread cards in the transcript, modelled on Claude's: the notice that replaces "收到执行请求",
// and the turn-tail "N 条回复" card listing the threads a turn opened.
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { useMemo, useState } from 'react'
import type { NoticeData } from './chat.ts'
import { OPENED_KEY } from './chat.ts'
import { ThreadsIcon } from './icons.tsx'
import type { MessageKey, Translate } from './locale.ts'
import { type ThreadCardInfo, type ThreadView, useHostValue, useThreadsRevision } from './threads.ts'

type UseStatus = <T>(selector: (statuses: ReadonlyMap<string, { running?: boolean }>) => T) => T
type DotState = 'idle' | 'ongoing' | 'done' | 'warning' | 'error'

const STATUS_KEYS: Record<string, MessageKey> = {
  done: 'status.done',
  blocked: 'status.blocked',
  needs_decision: 'status.needsDecision',
  failed: 'status.failed',
  'no-report': 'status.noReport',
}

function reportDot(status: string | undefined): DotState {
  if (status === 'done') return 'done'
  if (status === 'blocked' || status === 'needs_decision') return 'warning'
  if (status === 'failed') return 'error'
  return 'idle'
}

function ThreadRow({ card, dot, label, summary, t, openThread }: {
  card: ThreadCardInfo
  dot: DotState
  label?: string
  summary?: string
  t: Translate
  openThread: (threadId: string) => void
}) {
  return (
    <div className="dsht-card-row">
      <StateDot state={dot} className="dsht-dot" />
      <div className="dsht-row-body">
        <span className="dsht-row-title">#{card.n} {card.title}{label === undefined ? null : <span className="dsht-row-status"> · {label}</span>}</span>
        {summary === undefined || summary.length === 0 ? null : <span className="dsht-row-summary">{summary}</span>}
      </div>
      <Button size="sm" variant="outline" onClick={() => openThread(card.threadId)}>{t('card.open')}</Button>
    </div>
  )
}

/** conversation.chat.node renderer for NOTICE_NODE. */
export function NoticeCard({ node, t, openThread }: {
  node: { data: NoticeData }
  t: Translate
  openThread: (threadId: string) => void
}) {
  const { role, threads, summary, text } = node.data
  const [expanded, setExpanded] = useState(false)

  if (role === 'report' && threads.length > 0) {
    return (
      <div className="dsht-chat-card">
        <div className="dsht-chat-card-head"><ThreadsIcon size={14} />{t('notice.report', { count: threads.length })}</div>
        {threads.map((card) => (
          <ThreadRow key={card.threadId} card={card} dot={reportDot(card.status)}
            label={card.status === undefined ? undefined : t(STATUS_KEYS[card.status] ?? 'status.noReport')}
            summary={card.summary} t={t} openThread={openThread} />
        ))}
      </div>
    )
  }

  // A brief or a follow-up, shown inside the thread; or an older notice without card data.
  const card = threads[0]
  const heading = role === 'brief' ? t('notice.brief') : role === 'reply' ? t('notice.reply') : summary
  const body = text.split('\n').filter((line, index) => !(index === 0 && line.startsWith('['))).join('\n').trim()
  return (
    <div className="dsht-chat-card">
      <div className="dsht-chat-card-head">
        <ThreadsIcon size={14} />
        <span>{heading}{card === undefined ? '' : ` · #${card.n} ${card.title}`}</span>
      </div>
      {body.length === 0 ? null : (
        <button type="button" className={`dsht-chat-card-text ${expanded ? '' : 'dsht-clamped'}`} onClick={() => setExpanded(!expanded)}>
          {body}
        </button>
      )}
    </div>
  )
}

/** conversation.chat.turnTail entry: the threads this turn opened ("N 条回复"). */
export function TurnThreadsCard({ turn, sessionId, useSessionStatus, t, openThread }: {
  turn: { data: { get(key: string): unknown } }
  sessionId: string
  useSessionStatus: UseStatus
  t: Translate
  openThread: (threadId: string) => void
}) {
  const opened = (turn.data.get(OPENED_KEY) as { opened?: ThreadCardInfo[] } | undefined)?.opened ?? []
  const revision = useThreadsRevision()
  const runningKey = useSessionStatus((statuses) =>
    [...statuses].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(','))
  const running = useMemo(() => new Set(runningKey.split(',')), [runningKey])
  const threads = useHostValue<ThreadView[]>(opened.length === 0 ? null : 'threads.list', { mainSessionId: sessionId }, [sessionId, runningKey, revision])
  if (opened.length === 0) return null
  const byId = new Map((threads ?? []).map((thread) => [thread.id, thread]))
  return (
    <div className="dsht-chat-card dsht-turn-card">
      <div className="dsht-chat-card-head"><ThreadsIcon size={14} />{t('card.replies', { count: opened.length })}</div>
      {opened.map((card) => {
        const thread = byId.get(card.threadId)
        const isRunning = running.has(card.threadId) || thread?.status === 'running' || thread?.status === 'starting'
        const dot: DotState = isRunning ? 'ongoing' : reportDot(thread?.lastReport?.status)
        const label = isRunning ? t('status.running') : thread?.resolved ? t('list.resolved') : undefined
        return (
          <ThreadRow key={card.threadId} card={card} dot={dot} label={label}
            summary={isRunning ? undefined : thread?.lastReport?.summary} t={t} openThread={openThread} />
        )
      })}
    </div>
  )
}
