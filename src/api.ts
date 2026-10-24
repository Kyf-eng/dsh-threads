// Methods served on POST /api/dsh-threads for the browser half (src/client).
import { z } from 'zod'
import type { ThreadManager } from './manager.ts'
import { ProjectError, type Projects } from './projects.ts'
import type { RpcHandlers } from './rpc.ts'
import { plainLine, truncate } from './report.ts'
import type { NotifyLevel, ThreadRecord } from './types.ts'

const createInput = z.object({
  title: z.string(),
  workspaceId: z.string().optional(),
  folder: z.string().optional(),
  fromSessionId: z.string().optional(),
  instructions: z.string().optional(),
})
const modelInput = z.object({ provider: z.string(), model: z.string(), reasoningEffort: z.string().optional() })
const updateInput = z.object({
  id: z.string(),
  title: z.string().optional(),
  instructions: z.string().optional(),
  icon: z.string().optional(),
  goal: z.string().optional(),
  notify: z.enum(['all', 'attention', 'waiting', 'none']).optional(),
  mainModel: modelInput.nullable().optional(),
  threadModel: modelInput.nullable().optional(),
})
const pinInput = z.object({ id: z.string(), pinned: z.boolean() })
const idInput = z.object({ id: z.string() })
const mainInput = z.object({ mainSessionId: z.string() })
const proposalsInput = z.object({ mainSessionId: z.string(), ids: z.array(z.string()) })
const sessionsInput = z.object({ ids: z.array(z.string()).max(50) })

/** What a desktop notification needs about a session that just stopped running. */
export interface NotifyTarget {
  sessionId: string
  kind: 'main' | 'thread'
  mainSessionId: string
  projectTitle: string
  level: NotifyLevel
  /** A thread that stopped to ask the user something. */
  waiting: boolean
  n: number | null
  title: string | null
  /** Report status of a thread (`done`, `needs_decision`, …, `no-report`). */
  status: string | null
  /** The decision a waiting thread asks for, a thread's summary, or the main conversation's last reply. */
  text: string
}

const NOTIFY_TEXT_MAX = 160

/** Describe one session for a notification; null when it belongs to no (active) project. */
export function notifyTarget(id: string, deps: {
  thread: (id: string) => ThreadRecord | undefined
  projectOfMain: (mainSessionId: string) => { title: string; notify: NotifyLevel; archived: boolean } | undefined
  lastReply: (sessionId: string) => string | undefined
}): NotifyTarget | null {
  const thread = deps.thread(id)
  const project = deps.projectOfMain(thread?.mainSessionId ?? id)
  if (project === undefined || project.archived) return null
  const clip = (text: string | undefined) => truncate(plainLine(text ?? ''), NOTIFY_TEXT_MAX)
  if (thread === undefined) {
    return {
      sessionId: id, kind: 'main', mainSessionId: id, projectTitle: project.title, level: project.notify,
      waiting: false, n: null, title: null, status: null, text: clip(deps.lastReply(id)),
    }
  }
  const report = thread.lastReport
  const waiting = isWaiting(thread)
  return {
    sessionId: id, kind: 'thread', mainSessionId: thread.mainSessionId, projectTitle: project.title, level: project.notify,
    waiting, n: thread.n, title: thread.title, status: report?.status ?? 'no-report',
    text: clip(waiting ? report?.decisions[0] ?? report?.summary : report?.summary ?? deps.lastReply(id)),
  }
}

/** What the panel shows for a thread; the brief and internal round bookkeeping stay on the host. */
export type ThreadSummary = Pick<ThreadRecord, 'id' | 'mainSessionId' | 'n' | 'title' | 'status' | 'resolved' | 'archived' | 'initiation' | 'lastReport' | 'error' | 'createdAt' | 'updatedAt'> & {
  worktree: { branch: string; path: string; removed: boolean } | null
}

export function summarize(thread: ThreadRecord): ThreadSummary {
  const { id, mainSessionId, n, title, status, resolved, archived, initiation, lastReport, error, createdAt, updatedAt } = thread
  const worktree = thread.worktree === null ? null : { branch: thread.worktree.branch, path: thread.worktree.path, removed: thread.worktree.removed }
  return { id, mainSessionId, n, title, status, resolved, archived, initiation, lastReport, error, worktree, createdAt, updatedAt }
}

/** A thread that stopped to ask the user something (Claude's raised hand). */
export function isWaiting(thread: ThreadRecord): boolean {
  const status = thread.lastReport?.status
  return !thread.resolved && !thread.archived && thread.status === 'idle' && (status === 'needs_decision' || status === 'blocked')
}

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload)
  if (!result.success) throw new ProjectError(`请求参数不对：${result.error.issues.map((issue) => issue.message).join('；')}`)
  return result.data
}

export function apiHandlers(deps: {
  projects: Projects
  manager: ThreadManager
  threadsOf: (mainSessionId: string) => ThreadRecord[]
  thread: (id: string) => ThreadRecord | undefined
  threads: () => ThreadRecord[]
  plugin: { name: string; version: string }
  modelCatalog: () => Promise<unknown>
  /** Text of a session's latest assistant reply, when its agent is live. */
  lastReply: (sessionId: string) => string | undefined
}): RpcHandlers {
  const { projects, manager, threadsOf, plugin } = deps
  // Threads of a deleted project are ordinary conversations again: not hidden, not locked.
  const projectThreads = () => deps.threads().filter((t) => projects.ofMain(t.mainSessionId) !== undefined)
  const requireThread = (id: string) => {
    const thread = deps.thread(id)
    if (thread === undefined) throw new ProjectError('找不到这个讨论串。')
    return thread
  }
  return {
    ping: () => ({ ok: true, plugin }),
    'projects.list': () => projects.list(),
    'projects.create': (payload) => projects.create(parse(createInput, payload)),
    'projects.update': (payload) => {
      const { id, ...patch } = parse(updateInput, payload)
      return projects.update(id, patch)
    },
    'projects.pin': (payload) => {
      const { id, pinned } = parse(pinInput, payload)
      return projects.setPinned(id, pinned)
    },
    'projects.archive': (payload) => projects.archive(parse(idInput, payload).id),
    'projects.usage': (payload) => projects.usage(parse(idInput, payload).id),
    /** DSH's model catalog (providers, models, reasoning efforts, the default) for the model menus. */
    'models.catalog': () => deps.modelCatalog(),
    /** Sessions that just stopped running, as far as they belong to projects (notifications). */
    'notifications.describe': (payload) => parse(sessionsInput, payload).ids.flatMap((id) => {
      const target = notifyTarget(id, { thread: deps.thread, projectOfMain: (main) => projects.ofMain(main), lastReply: deps.lastReply })
      return target === null ? [] : [target]
    }),
    'projects.unarchive': (payload) => projects.unarchive(parse(idInput, payload).id),
    'projects.remove': async (payload) => {
      await projects.remove(parse(idInput, payload).id)
      return { ok: true }
    },
    /** Which project (if any) a session belongs to, and whether it is a thread. */
    'sessions.role': (payload) => {
      const { id } = parse(idInput, payload)
      return { project: projects.ofSession(id) ?? null, thread: manager.isThread(id) }
    },
    'threads.list': (payload) => threadsOf(parse(mainInput, payload).mainSessionId).map(summarize),
    /** One thread for the thread pane header, with its project's title. */
    'threads.get': (payload) => {
      const thread = requireThread(parse(idInput, payload).id)
      return { ...summarize(thread), projectTitle: projects.ofMain(thread.mainSessionId)?.title ?? null }
    },
    'threads.resolve': async (payload) => summarize(await manager.setResolved(parse(idInput, payload).id, true)),
    'threads.reopen': async (payload) => summarize(await manager.setResolved(parse(idInput, payload).id, false)),
    'threads.stop': async (payload) => summarize(await manager.stop(parse(idInput, payload).id)),
    'threads.archive': async (payload) => summarize(await manager.setArchived(parse(idInput, payload).id, true)),
    'threads.unarchive': async (payload) => summarize(await manager.setArchived(parse(idInput, payload).id, false)),
    /** Ids of every resolved thread; the client locks their composers. */
    'threads.resolved': () => projectThreads().filter((t) => t.resolved).map((t) => t.id),
    /** Which sessions are threads and which are project main conversations (sidebar row badges). */
    /**
     * Thread ids (hidden from the sidebar) and, per project main conversation, how many threads
     * it has, how many run and how many wait on the user (its row shows ↳N and a state mark).
     */
    'sessions.kinds': () => ({
      threads: projectThreads().map((t) => t.id),
      mains: projects.list().map((p) => {
        const threads = threadsOf(p.mainSessionId)
        return {
          id: p.mainSessionId,
          icon: p.icon,
          threads: threads.filter((t) => !t.archived).length,
          running: threads.filter((t) => t.status === 'running' || t.status === 'starting').length,
          waiting: threads.filter(isWaiting).length,
        }
      }),
    }),
    'proposals.list': (payload) => manager.proposals(parse(mainInput, payload).mainSessionId),
    'proposals.start': (payload) => {
      const { mainSessionId, ids } = parse(proposalsInput, payload)
      return manager.startProposals(mainSessionId, ids)
    },
    'proposals.dismiss': async (payload) => {
      const { mainSessionId, ids } = parse(proposalsInput, payload)
      await manager.dismissProposals(mainSessionId, ids)
      return { ok: true }
    },
  }
}
