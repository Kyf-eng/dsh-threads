import type { Config } from './config.ts'
import type { MainAgent } from './delivery.ts'
import { flushNotes } from './delivery.ts'
import { composeNote, currentReport, normalizeReport, noticeSummary, plainLine, truncate } from './report.ts'
import type { ThreadCardInfo } from './source.ts'
import type { ThreadStore } from './store.ts'
import type { Initiation, PendingNote, ProposalRecord, ThreadRecord, ThreadReport, ThreadWorktree } from './types.ts'
import type { RemoveResult } from './worktree.ts'

/** Longest report summary carried on a transcript card. */
const CARD_SUMMARY_MAX = 160

function cardOf(thread: Pick<ThreadRecord, 'id' | 'n' | 'title' | 'worktree'>): ThreadCardInfo {
  const card: ThreadCardInfo = { threadId: thread.id, n: thread.n, title: thread.title }
  return thread.worktree === null ? card : { ...card, branch: thread.worktree.branch }
}

/** A live session agent, reduced to what thread orchestration needs. */
export interface ThreadAgent extends MainAgent {
  readonly id: string
  /** Current session log offset. */
  readonly seq: number
}

/** DSH services behind the manager (src/host.ts adapts the real ones). */
export interface ThreadHost {
  /** Create an ordinary session in the main conversation's workspace and return its agent. */
  createSession(mainSessionId: string, sessionId: string): Promise<ThreadAgent>
  /** The live agent for a session, resuming it when needed. */
  resolve(sessionId: string): Promise<ThreadAgent | undefined>
  rename(sessionId: string, title: string): void
  /** Give the thread the main conversation's current permission preset. */
  inheritPermission(mainSessionId: string, threadId: string): void
  /** Text of the thread's last assistant reply since `fromSeq`. */
  roundOutput(threadId: string, fromSeq: number): string | undefined
  /** A new worktree branched from the main conversation's folder (throws WorktreeError when it cannot). */
  createWorktree(mainSessionId: string, name: string): Promise<ThreadWorktree>
  /** Make `path` the thread's working directory. */
  enterDirectory(threadId: string, path: string): Promise<void>
  removeWorktree(worktree: ThreadWorktree): Promise<RemoveResult>
}

export interface OpenInput {
  title: string
  task: string
  initiation: Initiation
  /** Give the thread its own git worktree and branch (for threads that change files). */
  worktree?: boolean
}

export interface ManagerDeps {
  store: ThreadStore
  host: ThreadHost
  config: Config
  now: () => string
  newSessionId: () => string
  newProposalId: () => string
  warn: (message: string) => void
}

/** A refusal the model should read and act on (not a bug). */
export class ThreadError extends Error {}

const TITLE_MAX = 30

export const NOT_A_PROJECT = '只有项目的主对话能开讨论串。先在左侧"项目"里新建项目，或在会话菜单里选"设为项目"。'

export function titleFrom(task: string): string {
  return truncate(task.trim().split('\n', 1)[0]?.trim() ?? '', TITLE_MAX)
}

/** First message of a dispatched round: the brief, framed so the thread knows where it came from. */
export function briefText(thread: Pick<ThreadRecord, 'n' | 'title'>, task: string): string {
  return [
    `[来自主对话的任务 · 讨论串 #${thread.n}「${thread.title}」]`,
    '',
    task.trim(),
    '',
    '（重要：结束本轮回复之前，必须调用一次 thread_report。主对话只能收到 thread_report 的内容，收不到你的回复正文。）',
  ].join('\n')
}

/** A follow-up instruction from the main conversation (thread_reply). */
export function replyText(thread: Pick<ThreadRecord, 'n' | 'title'>, message: string): string {
  return [
    `[来自主对话的追加指令 · 讨论串 #${thread.n}「${thread.title}」]`,
    '',
    message.trim(),
    '',
    '（做完后同样要调用一次 thread_report。）',
  ].join('\n')
}

export class ThreadManager {
  /** Sessions being created right now; `agent/created` fires before the record says `running`. */
  private readonly creating = new Set<string>()
  /** Per-main-conversation serialization of delivery. */
  private readonly chains = new Map<string, Promise<void>>()
  /** Per-main-conversation serialization of opening threads (running limit, numbers, proposal queue). */
  private readonly openings = new Map<string, Promise<unknown>>()
  /** Threads whose round ended but whose note is not queued yet; delivery counts them as running. */
  private readonly settling = new Set<string>()

  constructor(private readonly deps: ManagerDeps) {}

  isThread(sessionId: string): boolean {
    return this.creating.has(sessionId) || this.deps.store.thread(sessionId) !== undefined
  }

  /** The live worktree a thread works in, if any (for its system prompt). */
  worktreeOf(sessionId: string): ThreadWorktree | null {
    const worktree = this.deps.store.thread(sessionId)?.worktree ?? null
    return worktree === null || worktree.removed ? null : worktree
  }

  /** Only a project's main conversation dispatches threads (as in Claude). */
  isDispatcher(sessionId: string): boolean {
    return this.deps.store.projectOfMain(sessionId) !== undefined
  }

  runningCount(mainSessionId: string): number {
    return this.deps.store.threadsOf(mainSessionId).filter((t) => t.status === 'starting' || t.status === 'running').length
  }

  /** Open a thread. Opens for one main conversation run one at a time, so parallel calls cannot overshoot the limit or share a number. */
  open(mainSessionId: string, input: OpenInput): Promise<ThreadRecord> {
    return this.opening(mainSessionId, () => this.openNow(mainSessionId, input))
  }

  private opening<T>(mainSessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.openings.get(mainSessionId) ?? Promise.resolve()
    const next = previous.then(task, task)
    this.openings.set(mainSessionId, next.catch(() => undefined))
    return next
  }

  private async openNow(mainSessionId: string, input: OpenInput): Promise<ThreadRecord> {
    const { store, host, config, now } = this.deps
    if (this.isThread(mainSessionId)) throw new ThreadError('讨论串里不能再开讨论串；把这个需要写进 thread_report 的 decisions，交给主对话决定。')
    if (!this.isDispatcher(mainSessionId)) throw new ThreadError(NOT_A_PROJECT)
    const task = input.task.trim()
    if (task.length === 0) throw new ThreadError('task 不能为空：写一份完整的简报。')
    const running = this.runningCount(mainSessionId)
    if (running >= config.maxRunning) {
      throw new ThreadError(`已有 ${running} 个讨论串在运行（上限 ${config.maxRunning}）。等有讨论串回报后再开，或者这件事在主对话里做。`)
    }

    const n = Math.max(0, ...store.threadsOf(mainSessionId).map((t) => t.n)) + 1
    const title = truncate(input.title.trim(), TITLE_MAX) || titleFrom(task)
    const id = this.deps.newSessionId()
    // Before the session exists, so a folder that is not a git repository costs nothing.
    let worktree: ThreadWorktree | null = null
    if (input.worktree === true) {
      try {
        worktree = await host.createWorktree(mainSessionId, `${n}-${id.replace(/^session-/, '').slice(0, 6)}`)
      } catch (error) {
        throw new ThreadError(`没法给讨论串开 worktree：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const createdAt = now()
    let record: ThreadRecord = {
      id, mainSessionId, n, title, task,
      initiation: input.initiation,
      status: 'starting',
      resolved: false,
      round: null, roundStartSeq: null, roundStartedAt: null,
      lastReport: null, error: null,
      worktree,
      createdAt, updatedAt: createdAt,
    }
    this.creating.add(id)
    try {
      await store.putThread(record)
      const agent = await host.createSession(mainSessionId, id)
      if (worktree !== null) await host.enterDirectory(id, worktree.path)
      try {
        host.rename(id, `#${n} ${title}`)
      } catch (error) {
        this.deps.warn(`dsh-threads: could not rename thread ${id}: ${String(error)}`)
      }
      if (config.inheritPermissionPreset) host.inheritPermission(mainSessionId, id)
      record = await this.dispatch(record, agent, briefText(record, task))
      return record
    } catch (error) {
      record = { ...record, status: 'failed', error: String(error), updatedAt: now() }
      await store.putThread(record)
      throw error
    } finally {
      this.creating.delete(id)
    }
  }

  /** Start a round the main conversation asked for. The record is saved before the message is sent. */
  private async dispatch(record: ThreadRecord, agent: ThreadAgent, text: string): Promise<ThreadRecord> {
    const at = this.deps.now()
    const next: ThreadRecord = { ...record, status: 'running', round: 'dispatch', roundStartSeq: agent.seq, roundStartedAt: at, updatedAt: at }
    await this.deps.store.putThread(next)
    agent.followup(text, noticeSummary(next, '任务'), { role: 'brief', threads: [cardOf(next)], wake: true })
    return next
  }

  /**
   * thread_reply: send a thread more instructions. An idle thread starts a new dispatched
   * round; a running one gets the message as its next turn, and its result is reported
   * with wake-up rules even if the user started the current round.
   */
  async reply(mainSessionId: string, n: number, message: string): Promise<ThreadRecord> {
    const text = message.trim()
    if (text.length === 0) throw new ThreadError('message 不能为空。')
    const thread = this.deps.store.threadsOf(mainSessionId).find((t) => t.n === n)
    if (thread === undefined) throw new ThreadError(`这个主对话没有讨论串 #${n}。`)
    if (thread.status === 'failed' || thread.status === 'starting') {
      throw new ThreadError(`讨论串 #${n} 没有建好（${thread.status}），不能追加；需要的话重新开一个。`)
    }
    const agent = await this.deps.host.resolve(thread.id)
    if (agent === undefined) throw new ThreadError(`讨论串 #${n} 现在连不上（会话可能已被归档或删除）。`)
    const at = this.deps.now()
    const next: ThreadRecord = thread.round === null
      ? { ...thread, status: 'running', round: 'dispatch', roundStartSeq: agent.seq, roundStartedAt: at, resolved: false, updatedAt: at }
      : { ...thread, round: 'dispatch', resolved: false, updatedAt: at }
    await this.deps.store.putThread(next)
    agent.followup(replyText(next, text), noticeSummary(next, '追加指令'), { role: 'reply', threads: [cardOf(next)], wake: true })
    return next
  }

  /**
   * After DSH restarts: threads left `starting` failed; `running` threads whose agent is now
   * idle are settled (their report or last reply goes to the main conversation); notes still
   * waiting for a main conversation are delivered.
   */
  async recover(): Promise<void> {
    const { store, host, now } = this.deps
    for (const thread of store.threads()) {
      if (thread.status === 'starting') {
        await store.putThread({ ...thread, status: 'failed', error: 'DSH 重启时讨论串还没建好。', updatedAt: now() })
        continue
      }
      if (thread.status !== 'running') continue
      const agent = await host.resolve(thread.id)
      if (agent === undefined) {
        await store.putThread({ ...thread, status: 'failed', round: null, error: 'DSH 重启后连不上这个讨论串。', updatedAt: now() })
        continue
      }
      if (agent.status === 'idle') await this.onIdle(thread.id)
    }
    for (const main of store.mains()) {
      if (main.pendingNotes.length > 0) await this.flush(main.id)
    }
  }

  /** A message entered a session's inbox. A user message in an idle thread starts a user-driven round. */
  async onInbox(sessionId: string, sourceKind: string, seq: number): Promise<void> {
    if (sourceKind !== 'user') return
    const thread = this.deps.store.thread(sessionId)
    if (thread === undefined) {
      await this.onMainUserMessage(sessionId)
      return
    }
    if (thread.round !== null) return
    const at = this.deps.now()
    await this.deps.store.putThread({ ...thread, status: 'running', round: 'user', roundStartSeq: seq, roundStartedAt: at, resolved: false, updatedAt: at })
  }

  /** The user spoke in a main conversation: automatic wake-ups may start again. */
  private async onMainUserMessage(mainSessionId: string): Promise<void> {
    const main = this.deps.store.main(mainSessionId)
    if (main.autoWakeStreak === 0) return
    await this.deps.store.putMain({ ...main, autoWakeStreak: 0 })
  }

  /** A session went idle: settle a thread's round, or deliver notes held for a main conversation. */
  async onIdle(sessionId: string): Promise<void> {
    const thread = this.deps.store.thread(sessionId)
    if (thread === undefined) {
      if (this.deps.store.main(sessionId).pendingNotes.length > 0) await this.flush(sessionId)
      return
    }
    if (thread.round === null) {
      if (thread.status === 'running') await this.deps.store.putThread({ ...thread, status: 'idle', updatedAt: this.deps.now() })
      return
    }
    // Until the note is queued, delivery must not mistake this thread for finished-and-reported:
    // another thread settling at the same moment would otherwise wake the main conversation alone.
    this.settling.add(thread.id)
    try {
      await this.settle(thread)
    } finally {
      this.settling.delete(thread.id)
    }
    await this.flush(thread.mainSessionId)
  }

  private async settle(thread: ThreadRecord): Promise<void> {
    const report = currentReport(thread)
    const fallback = report === null ? this.deps.host.roundOutput(thread.id, thread.roundStartSeq ?? 0) : undefined
    const note: PendingNote = {
      threadId: thread.id,
      text: composeNote(thread, report, fallback, this.deps.config.noteMaxChars),
      quiet: thread.round === 'user',
      card: {
        ...cardOf(thread),
        status: report?.status ?? 'no-report',
        summary: truncate(plainLine(report?.summary ?? fallback ?? ''), CARD_SUMMARY_MAX),
      },
    }
    await this.deps.store.putThread({ ...thread, status: 'idle', round: null, updatedAt: this.deps.now() })
    // Start queued proposals first: the note then waits for them, and the main conversation
    // hears from the whole batch once instead of once per thread.
    await this.drainQueue(thread.mainSessionId)
    await this.serial(thread.mainSessionId, async () => {
      const main = this.deps.store.main(thread.mainSessionId)
      await this.deps.store.putMain({ ...main, pendingNotes: [...main.pendingNotes, note] })
    })
  }

  /**
   * thread_propose: suggestions the model came up with itself. They wait in the proposals
   * card until the user starts or dismisses them (Claude's `own_initiative`).
   */
  async propose(mainSessionId: string, items: readonly { title: string; task: string; worktree?: boolean }[]): Promise<ProposalRecord[]> {
    const { store, config, now } = this.deps
    if (!this.isDispatcher(mainSessionId)) throw new ThreadError(NOT_A_PROJECT)
    const cleaned = items
      .map((item) => ({ task: item.task.trim(), title: truncate(item.title.trim(), TITLE_MAX), worktree: item.worktree === true }))
      .filter((item) => item.task.length > 0)
    if (cleaned.length === 0) throw new ThreadError('至少要有一个带完整简报的提议。')
    if (cleaned.length > config.maxProposalsPerTurn) {
      throw new ThreadError(`一次最多提 ${config.maxProposalsPerTurn} 个讨论串；挑最值得做的。`)
    }
    const createdAt = now()
    const expiresAt = new Date(Date.parse(createdAt) + config.proposalTtlDays * 86_400_000).toISOString()
    const records = cleaned.map((item): ProposalRecord => ({
      id: this.deps.newProposalId(),
      mainSessionId,
      title: item.title || titleFrom(item.task),
      task: item.task,
      state: 'pending',
      worktree: item.worktree,
      threadId: null,
      createdAt,
      expiresAt,
    }))
    for (const record of records) await store.putProposal(record)
    return records
  }

  /** Proposals still waiting for the user (pending) or for a free slot (queued). Expired ones are dropped. */
  proposals(mainSessionId: string): ProposalRecord[] {
    const now = this.deps.now()
    return this.deps.store.proposalsOf(mainSessionId)
      .filter((p) => (p.state === 'pending' && p.expiresAt > now) || p.state === 'queued')
  }

  /** The user picked proposals: open as many as the running limit allows, queue the rest. */
  async startProposals(mainSessionId: string, ids: readonly string[]): Promise<ProposalRecord[]> {
    const { store } = this.deps
    for (const id of ids) {
      const proposal = store.proposal(id)
      if (proposal === undefined || proposal.mainSessionId !== mainSessionId || proposal.state !== 'pending') continue
      await store.putProposal({ ...proposal, state: 'queued' })
    }
    await this.drainQueue(mainSessionId)
    return ids.flatMap((id) => {
      const proposal = store.proposal(id)
      return proposal === undefined ? [] : [proposal]
    })
  }

  async dismissProposals(mainSessionId: string, ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      const proposal = this.deps.store.proposal(id)
      if (proposal === undefined || proposal.mainSessionId !== mainSessionId) continue
      if (proposal.state === 'pending' || proposal.state === 'queued') await this.deps.store.putProposal({ ...proposal, state: 'dismissed' })
    }
  }

  /** Start queued proposals, oldest first, while there is room under `maxRunning`. */
  private drainQueue(mainSessionId: string): Promise<void> {
    return this.opening(mainSessionId, async () => {
      for (const proposal of this.deps.store.proposalsOf(mainSessionId)) {
        if (proposal.state !== 'queued') continue
        if (this.runningCount(mainSessionId) >= this.deps.config.maxRunning) return
        try {
          const thread = await this.openNow(mainSessionId, { title: proposal.title, task: proposal.task, initiation: 'proposal', worktree: proposal.worktree })
          await this.deps.store.putProposal({ ...proposal, state: 'started', threadId: thread.id })
        } catch (error) {
          this.deps.warn(`dsh-threads: could not start proposal ${proposal.id}: ${String(error)}`)
          await this.deps.store.putProposal({ ...proposal, state: 'dismissed' })
        }
      }
    })
  }

  /** "标记已解决 / 重新打开" from the thread pane. A resolved thread's composer is locked in the UI. */
  async setResolved(threadId: string, resolved: boolean): Promise<ThreadRecord> {
    const thread = this.deps.store.thread(threadId)
    if (thread === undefined) throw new ThreadError('找不到这个讨论串。')
    if (thread.resolved === resolved) return thread
    const next = { ...thread, resolved, updatedAt: this.deps.now() }
    await this.deps.store.putThread(next)
    return next
  }

  async recordReport(threadId: string, input: Omit<ThreadReport, 'at'>): Promise<ThreadReport> {
    const thread = this.deps.store.thread(threadId)
    if (thread === undefined) throw new ThreadError('只有讨论串会话能调用 thread_report。')
    const report = normalizeReport(input, this.deps.config.summaryMaxChars, this.deps.now())
    await this.deps.store.putThread({ ...thread, lastReport: report, updatedAt: report.at })
    return report
  }

  /** Deliver held notes if the rules allow it now. */
  flush(mainSessionId: string): Promise<void> {
    return this.serial(mainSessionId, async () => {
      const main = this.deps.store.main(mainSessionId)
      if (main.pendingNotes.length === 0) return
      const agent = await this.deps.host.resolve(mainSessionId)
      if (agent === undefined) return
      const settling = this.deps.store.threadsOf(mainSessionId).filter((t) => this.settling.has(t.id)).length
      const { record } = flushNotes(main, agent, this.runningCount(mainSessionId) + settling, this.deps.config.maxAutoWakes)
      await this.deps.store.putMain(record)
    })
  }

  private serial(key: string, task: () => Promise<void>): Promise<void> {
    const previous = this.chains.get(key) ?? Promise.resolve()
    const next = previous.then(task, task)
    const settled = next.catch((error: unknown) => {
      this.deps.warn(`dsh-threads: delivery to ${key} failed: ${String(error)}`)
    })
    this.chains.set(key, settled)
    return next
  }

  /** Worktrees `/thread cleanup` would remove: threads of this main conversation that are not running. */
  cleanupCandidates(mainSessionId: string): ThreadRecord[] {
    return this.deps.store.threadsOf(mainSessionId)
      .filter((t) => t.worktree !== null && !t.worktree.removed && t.status !== 'running' && t.status !== 'starting')
  }

  /** `/thread cleanup confirm`: remove those worktrees (never forced) and say what happened to each. */
  async cleanupWorktrees(mainSessionId: string): Promise<string[]> {
    const lines: string[] = []
    for (const thread of this.cleanupCandidates(mainSessionId)) {
      const worktree = thread.worktree as ThreadWorktree
      let result: RemoveResult
      try {
        result = await this.deps.host.removeWorktree(worktree)
      } catch (error) {
        lines.push(`#${thread.n}：删除失败（${error instanceof Error ? error.message : String(error)}）`)
        continue
      }
      if (result.outcome === 'dirty') {
        lines.push(`#${thread.n}：${worktree.path} 里有没提交的改动，没删；先提交或丢弃。`)
        continue
      }
      await this.deps.store.putThread({ ...thread, worktree: { ...worktree, removed: true }, updatedAt: this.deps.now() })
      lines.push(`#${thread.n}：已删除 worktree，${result.branchKept ? `分支 ${worktree.branch} 还有没合并的提交，保留` : `分支 ${worktree.branch} 已合并，一并删除`}。`)
    }
    return lines
  }

  /** Text for thread_status: every thread of this main conversation, or one thread in detail. */
  describe(mainSessionId: string, n?: number): string {
    const threads = this.deps.store.threadsOf(mainSessionId)
    if (n !== undefined) {
      const thread = threads.find((t) => t.n === n)
      if (thread === undefined) throw new ThreadError(`没有讨论串 #${n}。`)
      const report = thread.lastReport
      return [
        `讨论串 #${thread.n}「${thread.title}」· ${thread.status}（会话 ${thread.id}）`,
        thread.worktree === null ? '' : `worktree：${thread.worktree.path}，分支 ${thread.worktree.branch}${thread.worktree.removed ? '（已删除 worktree）' : ''}`,
        `任务：${truncate(thread.task, 600)}`,
        report === null
          ? '最新回报：无'
          : [
              `最新回报（${report.at}，${report.status}）：${report.summary}`,
              report.changedFiles.length > 0 ? `改动：${report.changedFiles.join('、')}` : '',
              report.decisions.length > 0 ? `待用户决定：${report.decisions.join('；')}` : '',
            ].filter((line) => line.length > 0).join('\n'),
        thread.error === null ? '' : `错误：${thread.error}`,
      ].filter((line) => line.length > 0).join('\n')
    }
    if (threads.length === 0) return '这个主对话还没有讨论串。'
    return threads.map((t) => {
      const latest = t.lastReport === null ? '无回报' : `${t.lastReport.status}：${truncate(t.lastReport.summary, 80)}`
      return `#${t.n}「${t.title}」· ${t.status} · ${latest}`
    }).join('\n')
  }
}
