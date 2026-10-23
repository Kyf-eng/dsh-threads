// Right-sidebar tab showing one thread's live conversation, with its own composer.
// Body shape copied from dsh-client-ui-subagent's SidebarChatTab / ConversationSlotPanel,
// but for ordinary sessions (the `subagentchat` resource would reroute them as subagents).
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState, type ReactNode } from 'react'
import type { Translate } from './locale.ts'
import { setThreadResolved } from './resolved.ts'
import { dotState, parseThreadAddress, type ThreadDetail, useHostValue, useThreadsRevision } from './threads.ts'

/** Session-scoped child slot this tab declares; only the declaring entry may render it. */
export const THREAD_CONVERSATION_SLOT = 'dsh-threads.chat.conversation'

type RenderSlot = (name: string, props: Record<string, unknown>, options?: unknown) => ReactNode
type UseStatus = <T>(selector: (statuses: ReadonlyMap<string, { running?: boolean }>) => T) => T

export function ThreadChatTab({ useTabInfo, useResource, SessionProvider, renderSlot, useSessionStatus, t, openSession }: {
  useTabInfo: () => { tab: { contentId: string } }
  useResource: (address: string) => { value?: { reference: unknown } }
  SessionProvider: (props: { session: unknown; children: ReactNode }) => ReactNode
  renderSlot: RenderSlot
  useSessionStatus: UseStatus
  t: Translate
  openSession: (sessionId: string) => void
}) {
  const { tab } = useTabInfo()
  const threadId = parseThreadAddress(tab.contentId)
  const resource = useResource(tab.contentId)
  return (
    <div className="dsht-chat" data-dsh-threads-chat="">
      {threadId === undefined ? null : <ThreadPaneHeader threadId={threadId} useSessionStatus={useSessionStatus} t={t} openSession={openSession} />}
      <div className="dsht-chat-body">
        {resource.value === undefined
          ? null
          : <SessionProvider session={resource.value.reference}>{renderSlot(THREAD_CONVERSATION_SLOT, {})}</SessionProvider>}
      </div>
    </div>
  )
}

function ThreadPaneHeader({ threadId, useSessionStatus, t, openSession }: {
  threadId: string
  useSessionStatus: UseStatus
  t: Translate
  openSession: (sessionId: string) => void
}) {
  const running = useSessionStatus((statuses) => statuses.get(threadId)?.running === true)
  const revision = useThreadsRevision()
  const thread = useHostValue<ThreadDetail>('threads.get', { id: threadId }, [threadId, running, revision])
  const [busy, setBusy] = useState(false)
  if (thread === undefined) return <div className="dsht-pane-head" />
  const toggle = async () => {
    setBusy(true)
    try {
      await setThreadResolved(threadId, !thread.resolved)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="dsht-pane-head">
      <StateDot state={dotState(thread, running)} />
      <div className="dsht-pane-title" title={thread.title}>
        #{thread.n} {thread.title}
        {thread.projectTitle === null ? null : <span className="dsht-pane-project">{thread.projectTitle}</span>}
      </div>
      <Button size="sm" variant="ghost" disabled={busy || running} onClick={() => { void toggle() }}>
        {thread.resolved ? t('pane.reopen') : t('pane.resolve')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => openSession(threadId)}>{t('pane.openMain')}</Button>
    </div>
  )
}

/** The embedded Conversation for the thread the tab's SessionProvider supplies. */
export function ThreadConversation({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }: {
  sessionId: string
  useSession: <T>(selector: (session: SessionLike) => T) => T
  useConversation: <T>(selector: (conversation: { activeTargets: { size: number } }) => T) => T
  useSessions: <T>(selector: (state: { byId: Record<string, { blank?: boolean } | undefined> }) => T) => T
  renderFactorySlot: (name: string, props: Record<string, unknown>, options: { slots: Record<string, unknown> }) => ReactNode
}) {
  const session = useSession((value) => value)
  const active = useConversation((value) => value.activeTargets.size > 0) || (!session.blank && !session.awaitingFirstTurn) || session.running
  const summaryBlank = useSessions((state) => state.byId[sessionId]?.blank)
  // Never show the blank-session hero: its workspace picker would move the main view.
  const settling = !active && session.openState === 'loading' && summaryBlank !== true
  return renderFactorySlot(
    'conversation.content',
    { variant: 'embedded', phase: settling ? 'settling' : 'active', hero: false },
    { slots: { views: FixedChatConversationView } },
  )
}

interface SessionLike {
  blank: boolean
  awaitingFirstTurn: boolean
  running: boolean
  openState: string
}

function FixedChatConversationView(props: { renderSlot: RenderSlot }) {
  return <>{props.renderSlot('conversation.session', { view: 'chat' })}</>
}

/** Replaces the composer of a resolved thread (conversation.composer chain). */
export function ResolvedComposer({ sessionId, t }: { sessionId: string; t: Translate }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="dsht-resolved">
      <span>{t('resolved.notice')}</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => {
        setBusy(true)
        void setThreadResolved(sessionId, false).finally(() => setBusy(false))
      }}>
        {t('resolved.reopen')}
      </Button>
    </div>
  )
}
