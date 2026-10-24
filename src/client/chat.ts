// Chat Definitions (ctx.uiConversation.events.register): how our events show in the transcript.
// - noticeDefinition claims every user message whose source is `dsh-threads` (briefs, follow-ups,
//   reports) exclusively, so it renders as a thread card instead of "收到执行请求".
//   Pattern: dsh-client-ui-user-questions' questionReplyDefinition.
// - openedDefinition collects the threads `thread_open` opened in one turn and publishes them as
//   turn data for the turn-tail card ("N 条回复"). Pattern: dsh-client-ui-schedule's
//   scheduleTurnDefinition.
import type { ThreadCardInfo } from './threads.ts'

export const NOTICE_NODE = 'dsh-threads-notice'
export const OPENED_KEY = 'dsh-threads-opened'

interface ChatEvent {
  type: string
  seq: number
  time: unknown
  surfaceOp?: string
  data: Record<string, any>
}
interface Match {
  event: ChatEvent
}
interface DefinitionContext<S> {
  key: string
  id: string
  state: S | undefined
  start?: { location?: unknown }
  matches?: readonly { location?: unknown }[]
}

export interface NoticeData {
  time: unknown
  /** Started a turn (followup) vs. joined the context (inject); null on messages from before M2c. */
  wake: boolean | null
  role: 'brief' | 'reply' | 'reminder' | 'report' | null
  threads: ThreadCardInfo[]
  summary: string
  text: string
}

interface NoticeState extends NoticeData {
  seq: number
}

const isAppend = (event: ChatEvent) => event.surfaceOp === 'append'

const ROLES: ReadonlySet<unknown> = new Set(['brief', 'reply', 'reminder', 'report'])

function isCard(value: unknown): value is ThreadCardInfo {
  const card = value as ThreadCardInfo | null
  return typeof card === 'object' && card !== null && typeof card.threadId === 'string' && typeof card.n === 'number' && typeof card.title === 'string'
}

export const noticeDefinition = {
  kind: NOTICE_NODE,
  target: 'chat',
  match: (event: ChatEvent) => {
    if (event.type !== 'user/message' || !isAppend(event) || event.data.source?.kind !== 'dsh-threads') return null
    return { id: String(event.data.id), role: 'start', exclusive: true }
  },
  start: (_context: DefinitionContext<NoticeState>, match: Match): NoticeState => {
    const { event } = match
    const source = event.data.source ?? {}
    const content: { type: string; text?: string }[] = Array.isArray(event.data.content) ? event.data.content : []
    return {
      seq: event.seq,
      time: event.time,
      role: ROLES.has(source.role) ? source.role : null,
      wake: typeof source.wake === 'boolean' ? source.wake : null,
      threads: Array.isArray(source.threads) ? source.threads.filter(isCard) : [],
      summary: typeof source.summary === 'string' ? source.summary : '',
      text: content.find((block) => block.type === 'text')?.text ?? '',
    }
  },
  update: (context: DefinitionContext<NoticeState>) => context.state,
  buildViewNode: (context: DefinitionContext<NoticeState>) => {
    if (context.state === undefined) return null
    const { seq, ...data } = context.state
    return {
      key: context.key,
      kind: NOTICE_NODE,
      id: context.id,
      target: 'chat',
      anchorSeq: seq,
      location: context.start?.location ?? context.matches?.[0]?.location ?? { kind: 'unresolved' },
      visibility: 'visible',
      // Like Chat's own turn-trigger: a waking notice sits at the turn's input position; anything
      // else stays visible at its place. A node without groupTree is filtered out of finished turns.
      groupTree: data.wake === true ? 'input' : 'turn',
      data,
    }
  },
}

interface OpenedState {
  turn: number
  /** thread_open calls seen in this turn, by call id. */
  calls: ReadonlySet<string>
  opened: readonly ThreadCardInfo[]
}

export const openedDefinition = {
  kind: OPENED_KEY,
  match: (event: ChatEvent) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call' || (event.type === 'tool/result' && isAppend(event))) return { id: String(event.data.turn), role: 'update' }
    return null
  },
  start: (_context: DefinitionContext<OpenedState>, match: Match): OpenedState => {
    if (match.event.type !== 'turn/start') throw new Error('dsh-threads-opened start requires turn/start')
    return { turn: match.event.data.turn, calls: new Set(), opened: [] }
  },
  update: (context: DefinitionContext<OpenedState>, match: Match): OpenedState | undefined => {
    const state = context.state
    if (state === undefined) return state
    const { event } = match
    if (event.type === 'tool/call') {
      if (event.data.name !== 'thread_open') return state
      return { ...state, calls: new Set([...state.calls, String(event.data.callId)]) }
    }
    if (event.type !== 'tool/result') return state
    if (!state.calls.has(String(event.data.message?.source?.callId))) return state
    const meta = event.data.meta
    if (!isCard(meta) || state.opened.some((card) => card.threadId === meta.threadId)) return state
    return { ...state, opened: [...state.opened, { threadId: meta.threadId, n: meta.n, title: meta.title }] }
  },
  buildLocationData: (context: DefinitionContext<OpenedState>, scope: string, previous: { kind?: string; turn?: number; key?: string; value?: { opened?: unknown } } | null) => {
    const state = context.state
    if (scope !== 'turn' || state === undefined || state.opened.length === 0) return null
    if (previous?.kind === 'turn' && previous.turn === state.turn && previous.key === OPENED_KEY && previous.value?.opened === state.opened) return previous
    return { kind: 'turn', turn: state.turn, key: OPENED_KEY, value: { opened: state.opened } }
  },
}
