// Methods served on POST /api/dsh-threads for the browser half (src/client).
import { z } from 'zod'
import type { ThreadManager } from './manager.ts'
import { ProjectError, type Projects } from './projects.ts'
import type { RpcHandlers } from './rpc.ts'
import type { ThreadRecord } from './types.ts'

const createInput = z.object({
  title: z.string(),
  workspaceId: z.string().optional(),
  fromSessionId: z.string().optional(),
  instructions: z.string().optional(),
})
const updateInput = z.object({ id: z.string(), title: z.string().optional(), instructions: z.string().optional() })
const pinInput = z.object({ id: z.string(), pinned: z.boolean() })
const idInput = z.object({ id: z.string() })
const mainInput = z.object({ mainSessionId: z.string() })

/** What the panel shows for a thread; the brief and internal round bookkeeping stay on the host. */
export type ThreadSummary = Pick<ThreadRecord, 'id' | 'n' | 'title' | 'status' | 'resolved' | 'initiation' | 'lastReport' | 'error' | 'createdAt' | 'updatedAt'>

export function summarize(thread: ThreadRecord): ThreadSummary {
  const { id, n, title, status, resolved, initiation, lastReport, error, createdAt, updatedAt } = thread
  return { id, n, title, status, resolved, initiation, lastReport, error, createdAt, updatedAt }
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
  plugin: { name: string; version: string }
}): RpcHandlers {
  const { projects, manager, threadsOf, plugin } = deps
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
  }
}
