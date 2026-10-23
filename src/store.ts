import type { MainRecord, ThreadRecord } from './types.ts'

/** Durable plugin state: threads and per-main-conversation delivery state. Backed by src/storage.ts in DSH. */
export interface ThreadStore {
  thread(id: string): ThreadRecord | undefined
  threads(): ThreadRecord[]
  threadsOf(mainSessionId: string): ThreadRecord[]
  putThread(record: ThreadRecord): Promise<void>
  /** The main conversation's delivery state, or a fresh one when nothing is stored. */
  main(id: string): MainRecord
  putMain(record: MainRecord): Promise<void>
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
  return {
    thread: (id) => threads.get(id),
    threads: () => [...threads.values()],
    threadsOf: (mainSessionId) => [...threads.values()].filter((t) => t.mainSessionId === mainSessionId).sort(byNumber),
    putThread: async (record) => { threads.set(record.id, record) },
    main: (id) => mains.get(id) ?? emptyMain(id),
    putMain: async (record) => { mains.set(record.id, record) },
  }
}
