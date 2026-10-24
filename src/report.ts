import type { ThreadRecord, ThreadReport } from './types.ts'

const ELLIPSIS = '…'
/** Longest quote of one user message in a report. */
const USER_WORDS_MAX = 200

/** Cut `text` to at most `max` characters (code points), marking the cut. */
export function truncate(text: string, max: number): string {
  const chars = [...text]
  if (chars.length <= max) return text
  return chars.slice(0, Math.max(0, max - 1)).join('') + ELLIPSIS
}

/** One line of plain text for a card: markdown markers dropped, whitespace collapsed. */
export function plainLine(text: string): string {
  return text
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Plain text of content blocks (text blocks only), or undefined when there is none. */
export function textOf(blocks: readonly { type: string; text?: string }[] | undefined): string | undefined {
  const text = (blocks ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n')
    .trim()
  return text.length === 0 ? undefined : text
}

/** Clean up a model-supplied report: trim, bound the summary, drop empty list items. */
export function normalizeReport(input: {
  status: ThreadReport['status']
  summary: string
  changedFiles?: readonly string[]
  decisions?: readonly string[]
}, summaryMaxChars: number, at: string): ThreadReport {
  const items = (list: readonly string[] | undefined) => (list ?? []).map((item) => item.trim()).filter((item) => item.length > 0)
  return {
    status: input.status,
    summary: truncate(input.summary.trim(), summaryMaxChars),
    changedFiles: items(input.changedFiles),
    decisions: items(input.decisions),
    at,
  }
}

/** The report submitted during the current round, if any. */
export function currentReport(thread: ThreadRecord): ThreadReport | null {
  const report = thread.lastReport
  if (report === null || thread.roundStartedAt === null) return null
  return report.at >= thread.roundStartedAt ? report : null
}

/** One line for the chat UI's notice row (the UI bounds it further). */
export function noticeSummary(thread: Pick<ThreadRecord, 'n' | 'title'>, status: string): string {
  return `讨论串 #${thread.n}「${thread.title}」· ${status}`
}

/**
 * The note delivered to the main conversation: only the conclusion, changed files and
 * open decisions; the details stay in the thread (docs/IMPLEMENTATION.md §三).
 */
export function composeNote(
  thread: Pick<ThreadRecord, 'n' | 'title' | 'id'> & Partial<Pick<ThreadRecord, 'worktree' | 'round' | 'userMessages'>>,
  report: ThreadReport | null,
  fallbackText: string | undefined,
  maxChars: number,
): string {
  const status = report?.status ?? 'no-report'
  const lines = [`[讨论串 #${thread.n}「${thread.title}」· ${status} · 这是讨论串的报告，不是证据]`]
  // Right under the header so truncation never drops it.
  if (thread.worktree != null) {
    lines.push(`分支：${thread.worktree.branch}（讨论串自己的 worktree；改动不在项目文件夹里，用户要求时再合并）`)
  }
  // Also near the top: without it a change the user asked for in the thread reads as the thread's own idea.
  const said = (thread.userMessages ?? []).map((text) => `「${truncate(plainLine(text), USER_WORDS_MAX)}」`).join(' ')
  if (said.length > 0) {
    lines.push(thread.round === 'user'
      ? `这一轮是用户自己在讨论串里要求的，不是讨论串自作主张。用户的原话：${said}`
      : `这一轮中用户在讨论串里说过：${said}`)
  }
  if (report !== null) {
    lines.push(`摘要：${report.summary}`)
    if (report.changedFiles.length > 0) lines.push(`改动：${report.changedFiles.join('、')}`)
    if (report.decisions.length > 0) lines.push(`待用户决定：${report.decisions.join('；')}`)
  } else if (fallbackText !== undefined) {
    lines.push(`（讨论串没有调用 thread_report，以下是它最后一条回复）${fallbackText}`)
  } else {
    lines.push('（讨论串结束了，但没有回报也没有回复；用户可以点开讨论串查看。）')
  }
  lines.push(`详情：thread_status { n: ${thread.n} }，或让用户在侧栏打开该讨论串。`)
  return truncate(lines.join('\n'), maxChars)
}
