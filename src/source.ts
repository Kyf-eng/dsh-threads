import type { ContextFormed } from '@deepseek-ai/dsh-llm'

/** Message source kind for everything this plugin puts into a session inbox. */
export const SOURCE_KIND = 'dsh-threads'

/** What a thread card shows; carried on the message source so the transcript can render it. */
export interface ThreadCardInfo {
  threadId: string
  n: number
  title: string
  /** Report status (`done`, `blocked`, …) or `no-report`; absent on briefs and follow-ups. */
  status?: string
  /** First part of the report summary. */
  summary?: string
  /** The thread's worktree branch, when it has one. */
  branch?: string
  /** First decision the report asks the user for. */
  decision?: string
  /** Files the report says changed (first few). */
  files?: string[]
}

/**
 * brief: the first task in a thread; reply: a follow-up; reminder: "you did not call thread_report";
 * report: thread reports to the main conversation.
 */
export type NoticeRole = 'brief' | 'reply' | 'reminder' | 'report'

export interface NoticeMeta {
  role: NoticeRole
  threads: ThreadCardInfo[]
  /** True when the message starts a turn (followup); false when it only joins the context (inject). */
  wake: boolean
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'dsh-threads': { kind: 'dsh-threads'; role?: NoticeRole; threads?: ThreadCardInfo[]; wake?: boolean } & ContextFormed
  }
}
