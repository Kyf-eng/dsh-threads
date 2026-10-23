/** How a thread came to exist (docs/IMPLEMENTATION.md §一: Claude's `initiation`). Proposals arrive in M2. */
export type Initiation = 'user_asked' | 'offer'

export type ThreadStatus = 'starting' | 'running' | 'idle' | 'failed'

/** Status a thread declares in `thread_report`. */
export type ReportStatus = 'done' | 'blocked' | 'needs_decision' | 'failed'

export interface ThreadReport {
  status: ReportStatus
  summary: string
  changedFiles: string[]
  decisions: string[]
  /** ISO time the thread submitted it; compared with `roundStartedAt` to tell this round's report from a stale one. */
  at: string
}

/**
 * Who started the round now running in a thread: a task the main conversation sent
 * (`dispatch`, reported back with wake-up rules) or the user typing in the thread (`user`,
 * reported quietly, like Claude's notes from a turn the user drove).
 */
export type RoundOrigin = 'dispatch' | 'user'

export interface ThreadRecord {
  /** The thread's session id. */
  id: string
  mainSessionId: string
  /** Per-main-conversation serial number, shown as `#n`. */
  n: number
  title: string
  task: string
  initiation: Initiation
  status: ThreadStatus
  round: RoundOrigin | null
  /** Session log offset when the current round started; the round's events are read from here. */
  roundStartSeq: number | null
  roundStartedAt: string | null
  lastReport: ThreadReport | null
  error: string | null
  createdAt: string
  updatedAt: string
}

/** A report waiting to reach its main conversation. */
export interface PendingNote {
  threadId: string
  text: string
  /** Quiet notes never wake the main conversation; they ride along with its next turn. */
  quiet: boolean
}

export interface MainRecord {
  id: string
  /** Automatic wake-ups since the user last spoke in this main conversation. */
  autoWakeStreak: number
  pendingNotes: PendingNote[]
}
