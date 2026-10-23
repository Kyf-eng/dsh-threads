// Calls to the host half (src/api.ts) and a small shared store for the project list.
import { useSyncExternalStore } from 'react'

/**
 * Host route, relative to the page like DSH's own Connection calls: on Desktop the page is
 * dsh-app://app/ and the shell forwards it to the Host with its cookie; on Web it is same-origin.
 * Must match RPC_PATH in src/rpc.ts.
 */
const RPC_URL = 'api/dsh-threads'

export async function callHost<T>(method: string, payload: unknown = {}): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, payload }),
  })
  const body = await response.json().catch(() => ({})) as { result?: T; error?: string }
  if (!response.ok) throw new Error((body.error ?? `HTTP ${response.status}`).replace(/^(Project|Thread)?Error: /, ''))
  return body.result as T
}

/** Mirrors ProjectSummary in src/projects.ts. */
export interface ProjectView {
  id: string
  title: string
  workspaceId: string
  folder: string
  mainSessionId: string
  pinned: boolean
  instructions: string
  createdAt: string
  updatedAt: string
  threads: number
  running: number
  lastActivity: string
}

interface ProjectsState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  projects: readonly ProjectView[]
  error: string | null
}

let state: ProjectsState = { status: 'idle', projects: [], error: null }
const listeners = new Set<() => void>()
let inflight: Promise<void> | null = null

function publish(next: ProjectsState): void {
  state = next
  for (const listener of listeners) listener()
}

export const projectsStore = {
  getSnapshot: (): ProjectsState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  /** Reload from the host; concurrent calls share one request. */
  refresh(): Promise<void> {
    if (inflight !== null) return inflight
    if (state.status === 'idle') publish({ ...state, status: 'loading' })
    inflight = callHost<ProjectView[]>('projects.list')
      .then((projects) => publish({ status: 'ready', projects, error: null }))
      .catch((error: unknown) => publish({ ...state, status: 'error', error: error instanceof Error ? error.message : String(error) }))
      .finally(() => { inflight = null })
    return inflight
  },
}

export function useProjects(): ProjectsState {
  return useSyncExternalStore(projectsStore.subscribe, projectsStore.getSnapshot)
}
