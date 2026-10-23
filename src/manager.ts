import type { Config } from './config.ts'
import type { MainAgent } from './delivery.ts'
import { flushNotes } from './delivery.ts'
import { composeNote, currentReport, normalizeReport, noticeSummary, truncate } from './report.ts'
import type { ThreadStore } from './store.ts'
import type { Initiation, PendingNote, ThreadRecord, ThreadReport } from './types.ts'

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
}

export interface ManagerDeps {
  store: ThreadStore
  host: ThreadHost
  config: Config
  now: () => string
  newSessionId: () => string
  warn: (message: string) => void
}

/** A refusal the model should read and act on (not a bug). */
export class ThreadError extends Error {}

const TITLE_MAX = 30

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

export class ThreadManager {
  /** Sessions being created right now; `agent/created` fires before the record says `running`. */
  private readonly creating = new Set<string>()
  /** Per-main-conversation serialization of delivery. */
  private readonly chains = new Map<string, Promise<void>>()

  constructor(private readonly deps: ManagerDeps) {}

  isThread(sessionId: string): boolean {
    return this.creating.has(sessionId) || this.deps.store.thread(sessionId) !== undefined
  }

  runningCount(mainSessionId: string): number {
    return this.deps.store.threadsOf(mainSessionId).filter((t) => t.status === 'starting' || t.status === 'running').length
  }

  async open(mainSessionId: string, input: { title: string; task: string; initiation: Initiation }): Promise<ThreadRecord> {
    const { store, host, config, now } = this.deps
    if (this.isThread(mainSessionId)) throw new ThreadError('讨论串里不能再开讨论串；把这个需要写进 thread_report 的 decisions，交给主对话决定。')
    const task = input.task.trim()
    if (task.length === 0) throw new ThreadError('task 不能为空：写一份完整的简报。')
    const running = this.runningCount(mainSessionId)
    if (running >= config.maxRunning) {
      throw new ThreadError(`已有 ${running} 个讨论串在运行（上限 ${config.maxRunning}）。等它回报后再开，或者这件事在主对话里做。`)
    }

    const n = Math.max(0, ...store.threadsOf(mainSessionId).map((t) => t.n)) + 1
    const title = truncate(input.title.trim(), TITLE_MAX) || titleFrom(task)
    const id = this.deps.newSessionId()
    const createdAt = now()
    let record: ThreadRecord = {
      id, mainSessionId, n, title, task,
      initiation: input.initiation,
      status: 'starting',
      round: null, roundStartSeq: null, roundStartedAt: null,
      lastReport: null, error: null,
      createdAt, updatedAt: createdAt,
    }
    this.creating.add(id)
    try {
      await store.putThread(record)
      const agent = await host.createSession(mainSessionId, id)
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
    agent.followup(text, noticeSummary(next, '任务'))
    return next
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
    await this.deps.store.putThread({ ...thread, status: 'running', round: 'user', roundStartSeq: seq, roundStartedAt: at, updatedAt: at })
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
    if (thread.round === null) return
    const report = currentReport(thread)
    const fallback = report === null ? this.deps.host.roundOutput(thread.id, thread.roundStartSeq ?? 0) : undefined
    const note: PendingNote = {
      threadId: thread.id,
      text: composeNote(thread, report, fallback, this.deps.config.noteMaxChars),
      quiet: thread.round === 'user',
    }
    await this.deps.store.putThread({ ...thread, status: 'idle', round: null, updatedAt: this.deps.now() })
    await this.enqueue(thread.mainSessionId, note)
  }

  async recordReport(threadId: string, input: Omit<ThreadReport, 'at'>): Promise<ThreadReport> {
    const thread = this.deps.store.thread(threadId)
    if (thread === undefined) throw new ThreadError('只有讨论串会话能调用 thread_report。')
    const report = normalizeReport(input, this.deps.config.summaryMaxChars, this.deps.now())
    await this.deps.store.putThread({ ...thread, lastReport: report, updatedAt: report.at })
    return report
  }

  private async enqueue(mainSessionId: string, note: PendingNote): Promise<void> {
    await this.serial(mainSessionId, async () => {
      const main = this.deps.store.main(mainSessionId)
      await this.deps.store.putMain({ ...main, pendingNotes: [...main.pendingNotes, note] })
    })
    await this.flush(mainSessionId)
  }

  /** Deliver held notes if the rules allow it now. */
  flush(mainSessionId: string): Promise<void> {
    return this.serial(mainSessionId, async () => {
      const main = this.deps.store.main(mainSessionId)
      if (main.pendingNotes.length === 0) return
      const agent = await this.deps.host.resolve(mainSessionId)
      if (agent === undefined) return
      const { record } = flushNotes(main, agent, this.runningCount(mainSessionId), this.deps.config.maxAutoWakes)
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

  /** Text for thread_status: every thread of this main conversation, or one thread in detail. */
  describe(mainSessionId: string, n?: number): string {
    const threads = this.deps.store.threadsOf(mainSessionId)
    if (n !== undefined) {
      const thread = threads.find((t) => t.n === n)
      if (thread === undefined) throw new ThreadError(`没有讨论串 #${n}。`)
      const report = thread.lastReport
      return [
        `讨论串 #${thread.n}「${thread.title}」· ${thread.status}（会话 ${thread.id}）`,
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
