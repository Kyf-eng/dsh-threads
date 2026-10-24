// Methods served on POST /api/dsh-threads for the browser half (src/client).
import { z } from 'zod'
import type { ThreadManager } from './manager.ts'
import { ProjectError, type Projects } from './projects.ts'
import type { RpcHandlers } from './rpc.ts'
import type { ThreadRecord } from './types.ts'

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

/** What the panel shows for a thread; the brief and internal round bookkeeping stay on the host. */
export type ThreadSummary = Pick<ThreadRecord, 'id' | 'mainSessionId' | 'n' | 'title' | 'status' | 'resolved' | 'initiation' | 'lastReport' | 'error' | 'createdAt' | 'updatedAt'> & {
  worktree: { branch: string; path: string; removed: boolean } | null
}

export function summarize(thread: ThreadRecord): ThreadSummary {
  const { id, mainSessionId, n, title, status, resolved, initiation, lastReport, error, createdAt, updatedAt } = thread
  const worktree = thread.worktree === null ? null : { branch: thread.worktree.branch, path: thread.worktree.path, removed: thread.worktree.removed }
  return { id, mainSessionId, n, title, status, resolved, initiation, lastReport, error, worktree, createdAt, updatedAt }
}

/** A thread that stopped to ask the user something (Claude's raised hand). */
export function isWaiting(thread: ThreadRecord): boolean {
  const status = thread.lastReport?.status
  return !thread.resolved && thread.status === 'idle' && (status === 'needs_decision' || status === 'blocked')
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
}): RpcHandlers {
  const { projects, manager, threadsOf, plugin } = deps
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
    /** Ids of every resolved thread; the client locks their composers. */
    'threads.resolved': () => deps.threads().filter((t) => t.resolved).map((t) => t.id),
    /** Which sessions are threads and which are project main conversations (sidebar row badges). */
    /**
     * Thread ids (hidden from the sidebar) and, per project main conversation, how many threads
     * it has, how many run and how many wait on the user (its row shows ↳N and a state mark).
     */
    'sessions.kinds': () => ({
      threads: deps.threads().map((t) => t.id),
      mains: projects.list().map((p) => {
        const threads = threadsOf(p.mainSessionId)
        return {
          id: p.mainSessionId,
          icon: p.icon,
          threads: threads.length,
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
