// ThreadStore on DSH's storage-domain service (`<DSH_HOME>/storages/dsh_threads.json`).
// Fields added after M1 carry defaults so records written by earlier versions still read.
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { byCreated, byNumber, emptyMain, type ThreadStore } from './store.ts'
import type { MainRecord, ProjectRecord, ProposalRecord, ThreadRecord } from './types.ts'

const reportSchema = z.object({
  status: z.enum(['done', 'blocked', 'needs_decision', 'failed']),
  summary: z.string(),
  changedFiles: z.array(z.string()),
  decisions: z.array(z.string()),
  at: z.string(),
})

const threadSchema = z.object({
  id: z.string(),
  mainSessionId: z.string(),
  n: z.number().int().positive(),
  title: z.string(),
  task: z.string(),
  initiation: z.enum(['user_asked', 'offer', 'proposal']),
  status: z.enum(['starting', 'running', 'idle', 'failed']),
  resolved: z.boolean().default(false),
  round: z.enum(['dispatch', 'user']).nullable(),
  roundStartSeq: z.number().int().nonnegative().nullable(),
  roundStartedAt: z.string().nullable(),
  lastReport: reportSchema.nullable(),
  error: z.string().nullable(),
  worktree: z.object({
    path: z.string(),
    branch: z.string(),
    baseCommit: z.string(),
    repositoryRoot: z.string(),
    removed: z.boolean().default(false),
  }).nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const cardSchema = z.object({
  threadId: z.string(),
  n: z.number().int().positive(),
  title: z.string(),
  status: z.string().optional(),
  summary: z.string().optional(),
  branch: z.string().optional(),
})

const mainSchema = z.object({
  id: z.string(),
  autoWakeStreak: z.number().int().nonnegative(),
  pendingNotes: z.array(z.object({ threadId: z.string(), text: z.string(), quiet: z.boolean(), card: cardSchema.optional() })),
})

const proposalSchema = z.object({
  id: z.string(),
  mainSessionId: z.string(),
  title: z.string(),
  task: z.string(),
  state: z.enum(['pending', 'queued', 'started', 'dismissed']),
  worktree: z.boolean().default(false),
  threadId: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
})

const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  workspaceId: z.string(),
  folder: z.string(),
  mainSessionId: z.string(),
  pinned: z.boolean(),
  instructions: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Record keys are session ids (`session-<uuid>`) and project ids (`project-<uuid>`), which fit the domain's key pattern. */
export const domain = defineDomain({
  name: 'dsh_threads',
  version: 1,
  layout: 'single',
  tables: {
    threads: domainTable<string, ThreadRecord>(threadSchema),
    mains: domainTable<string, MainRecord>(mainSchema),
    projects: domainTable<string, ProjectRecord>(projectSchema),
    proposals: domainTable<string, ProposalRecord>(proposalSchema),
  },
})

export async function openStore(storageDomain: DomainFacility): Promise<ThreadStore> {
  const opened = await storageDomain.open(domain)
  const threads = opened.table('threads')
  const mains = opened.table('mains')
  const projects = opened.table('projects')
  const proposals = opened.table('proposals')
  const values = <V>(table: { entries(): IterableIterator<[string, V]> }) => [...table.entries()].map(([, record]) => record)
  return {
    proposal: (id) => proposals.get(id),
    proposalsOf: (mainSessionId) => values(proposals).filter((p) => p.mainSessionId === mainSessionId).sort(byCreated),
    putProposal: (record) => proposals.put(record.id, record),
    thread: (id) => threads.get(id),
    threads: () => values(threads),
    threadsOf: (mainSessionId) => values(threads).filter((t) => t.mainSessionId === mainSessionId).sort(byNumber),
    putThread: (record) => threads.put(record.id, record),
    main: (id) => mains.get(id) ?? emptyMain(id),
    mains: () => values(mains),
    putMain: (record) => mains.put(record.id, record),
    project: (id) => projects.get(id),
    projects: () => values(projects),
    projectOfMain: (mainSessionId) => values(projects).find((p) => p.mainSessionId === mainSessionId),
    putProject: (record) => projects.put(record.id, record),
    removeProject: async (id) => { await projects.delete(id) },
  }
}
