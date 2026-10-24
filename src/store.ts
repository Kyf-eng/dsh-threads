import type { MainRecord, ProjectRecord, ProposalRecord, ThreadRecord } from './types.ts'

/** Durable plugin state: projects, threads and per-main-conversation delivery state. Backed by src/storage.ts in DSH. */
export interface ThreadStore {
  thread(id: string): ThreadRecord | undefined
  threads(): ThreadRecord[]
  threadsOf(mainSessionId: string): ThreadRecord[]
  putThread(record: ThreadRecord): Promise<void>
  /** The main conversation's delivery state, or a fresh one when nothing is stored. */
  main(id: string): MainRecord
  mains(): MainRecord[]
  putMain(record: MainRecord): Promise<void>
  project(id: string): ProjectRecord | undefined
  projects(): ProjectRecord[]
  /** The project whose main conversation this session is. */
  projectOfMain(mainSessionId: string): ProjectRecord | undefined
  putProject(record: ProjectRecord): Promise<void>
  removeProject(id: string): Promise<void>
  proposal(id: string): ProposalRecord | undefined
  /** A main conversation's proposals, oldest first. */
  proposalsOf(mainSessionId: string): ProposalRecord[]
  putProposal(record: ProposalRecord): Promise<void>
}

export function byCreated(a: { createdAt: string }, b: { createdAt: string }): number {
  return a.createdAt.localeCompare(b.createdAt)
}

export function emptyMain(id: string): MainRecord {
  return { id, autoWakeStreak: 0, pendingNotes: [] }
}

export function byNumber(a: ThreadRecord, b: ThreadRecord): number {
  return a.n - b.n
}

/** In-memory store for tests. */
export function memoryStore(): ThreadStore {
  const threads = new Map<string, ThreadRecord>()
  const mains = new Map<string, MainRecord>()
  const projects = new Map<string, ProjectRecord>()
  const proposals = new Map<string, ProposalRecord>()
  return {
    proposal: (id) => proposals.get(id),
    proposalsOf: (mainSessionId) => [...proposals.values()].filter((p) => p.mainSessionId === mainSessionId).sort(byCreated),
    putProposal: async (record) => { proposals.set(record.id, record) },
    thread: (id) => threads.get(id),
    threads: () => [...threads.values()],
    threadsOf: (mainSessionId) => [...threads.values()].filter((t) => t.mainSessionId === mainSessionId).sort(byNumber),
    putThread: async (record) => { threads.set(record.id, record) },
    main: (id) => mains.get(id) ?? emptyMain(id),
    mains: () => [...mains.values()],
    putMain: async (record) => { mains.set(record.id, record) },
    project: (id) => projects.get(id),
    projects: () => [...projects.values()],
    projectOfMain: (mainSessionId) => [...projects.values()].find((p) => p.mainSessionId === mainSessionId),
    putProject: async (record) => { projects.set(record.id, record) },
    removeProject: async (id) => { projects.delete(id) },
  }
}
