// Projects, as in Claude: one folder (DSH workspace) + one standing main conversation.
// The projects page, the session menu and the /thread gate all go through here.
import { isAbsolute } from 'node:path'
import { msg } from './messages.ts'
import { truncate } from './report.ts'
import type { ThreadStore } from './store.ts'
import type { ModelChoice, NotifyLevel, ProjectRecord } from './types.ts'

const TITLE_MAX = 60
const INSTRUCTIONS_MAX = 4000
const GOAL_MAX = 8000
const ICON_MAX = 40
/** A full path in this system's own form, for the "write the full path" hint. */
const FOLDER_EXAMPLE = process.platform === 'win32' ? 'C:\\Users\\me\\code\\app' : process.platform === 'darwin' ? '/Users/me/code/app' : '/home/me/code/app'

/** A refusal shown to the user as-is (not a bug). */
export class ProjectError extends Error {}

export interface WorkspaceInfo {
  id: string
  path: string
}

/** DSH services behind Projects (src/host.ts adapts the real ones). */
export interface ProjectHost {
  /** Create a blank ordinary session in the workspace, titled `title`; returns its id. */
  createMainSession(workspaceId: string, title: string): Promise<string>
  workspace(workspaceId: string): WorkspaceInfo | undefined
  workspaceOf(sessionId: string): WorkspaceInfo | undefined
  /** The DSH workspace for a folder, adding it when the folder has none yet (throws when it is not a directory). */
  ensureWorkspace(folder: string, title: string): Promise<WorkspaceInfo>
  rename(sessionId: string, title: string): void
  /** Archive a session in DSH (it leaves the sidebar and cannot run); throws when it is busy. */
  archiveSession(sessionId: string): Promise<void>
  unarchiveSession(sessionId: string): Promise<void>
  /** Give a session this model (null: DSH's default) without changing DSH's default for new sessions. */
  applyModel(sessionId: string, choice: ModelChoice | null): Promise<void>
  /** Token usage per session, read from its projections (works for sessions that are not loaded). */
  sessionUsage(sessionId: string): Promise<TokenBuckets | null>
}

/** DSH's tokenUsage projection (dsh-token-meter). */
export interface TokenBuckets {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface UsageRow {
  sessionId: string
  kind: 'main' | 'thread'
  n: number | null
  title: string
  /** Uncached + cache read + cache write, as DSH's usage pill counts input. */
  input: number
  output: number
}

export interface ProjectUsage {
  total: { input: number; output: number }
  /** Main conversation first, then threads by total tokens, largest first. */
  rows: UsageRow[]
}

export interface ProjectSummary extends ProjectRecord {
  threads: number
  running: number
  /** Latest change to the project or any of its threads. */
  lastActivity: string
}

export interface ProjectsDeps {
  store: ThreadStore
  host: ProjectHost
  isThread: (sessionId: string) => boolean
  now: () => string
  newProjectId: () => string
}

function cleanTitle(title: string): string {
  const value = truncate(title.trim(), TITLE_MAX)
  if (value.length === 0) throw new ProjectError(msg().emptyProjectTitle)
  return value
}

function cleanInstructions(instructions: string | undefined): string {
  return truncate((instructions ?? '').trim(), INSTRUCTIONS_MAX)
}

export interface ProjectPatch {
  title?: string
  instructions?: string
  icon?: string
  goal?: string
  notify?: NotifyLevel
  mainModel?: ModelChoice | null
  threadModel?: ModelChoice | null
}

const sameModel = (a: ModelChoice | null, b: ModelChoice | null) =>
  a?.provider === b?.provider && a?.model === b?.model && a?.reasoningEffort === b?.reasoningEffort

export class Projects {
  private readonly listeners = new Set<() => void>()

  constructor(private readonly deps: ProjectsDeps) {}

  /** Called after any change, so per-session tools can follow the new project roles. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private changed(): void {
    for (const listener of this.listeners) listener()
  }

  ofMain(sessionId: string): ProjectRecord | undefined {
    return this.deps.store.projectOfMain(sessionId)
  }

  /** The project a session belongs to: as its main conversation, or as one of its threads. */
  ofSession(sessionId: string): ProjectRecord | undefined {
    const main = this.deps.store.thread(sessionId)?.mainSessionId ?? sessionId
    return this.deps.store.projectOfMain(main)
  }

  list(): ProjectSummary[] {
    const { store } = this.deps
    return store.projects().map((project) => {
      const threads = store.threadsOf(project.mainSessionId)
      const lastActivity = threads.reduce((latest, t) => (t.updatedAt > latest ? t.updatedAt : latest), project.updatedAt)
      return {
        ...project,
        // Threads the user archived one by one no longer count.
        threads: threads.filter((t) => !t.archived).length,
        running: threads.filter((t) => t.status === 'starting' || t.status === 'running').length,
        lastActivity,
      }
    })
  }

  async create(input: { title: string; workspaceId?: string; folder?: string; fromSessionId?: string; instructions?: string }): Promise<ProjectRecord> {
    const { store, host, now } = this.deps
    const title = cleanTitle(input.title)
    let workspace: WorkspaceInfo | undefined
    let mainSessionId: string
    if (input.fromSessionId !== undefined) {
      const existing = store.projectOfMain(input.fromSessionId)
      if (existing !== undefined) return existing
      if (this.deps.isThread(input.fromSessionId)) throw new ProjectError(msg().threadNotProject)
      workspace = host.workspaceOf(input.fromSessionId)
      if (workspace === undefined) throw new ProjectError(msg().notInWorkspace)
      mainSessionId = input.fromSessionId
    } else {
      const folder = input.folder?.trim()
      if (folder !== undefined && folder.length > 0) {
        if (!isAbsolute(folder)) throw new ProjectError(msg().absoluteFolder(FOLDER_EXAMPLE))
        try {
          workspace = await host.ensureWorkspace(folder, title)
        } catch (error) {
          throw new ProjectError(msg().badFolder(error instanceof Error ? error.message : String(error)))
        }
      } else {
        if (input.workspaceId === undefined) throw new ProjectError(msg().pickFolder)
        workspace = host.workspace(input.workspaceId)
        if (workspace === undefined) throw new ProjectError(msg().workspaceNotFound)
      }
      mainSessionId = await host.createMainSession(workspace.id, title)
    }
    const at = now()
    const project: ProjectRecord = {
      id: this.deps.newProjectId(),
      title,
      workspaceId: workspace.id,
      folder: workspace.path,
      mainSessionId,
      pinned: false,
      instructions: cleanInstructions(input.instructions),
      icon: 'folder',
      goal: '',
      archived: false,
      notify: 'attention',
      mainModel: null,
      threadModel: null,
      createdAt: at,
      updatedAt: at,
    }
    await store.putProject(project)
    this.changed()
    return project
  }

  private require(id: string): ProjectRecord {
    const project = this.deps.store.project(id)
    if (project === undefined) throw new ProjectError(msg().projectNotFound)
    return project
  }

  async update(id: string, patch: ProjectPatch): Promise<ProjectRecord> {
    const project = this.require(id)
    // The coordinator model is the main conversation's own selection: apply it before saving.
    if (patch.mainModel !== undefined && !sameModel(patch.mainModel, project.mainModel)) {
      try {
        await this.deps.host.applyModel(project.mainSessionId, patch.mainModel)
      } catch (error) {
        throw new ProjectError(msg().modelRefused(error instanceof Error ? error.message : String(error)))
      }
    }
    const next: ProjectRecord = {
      ...project,
      ...(patch.title === undefined ? {} : { title: cleanTitle(patch.title) }),
      ...(patch.instructions === undefined ? {} : { instructions: cleanInstructions(patch.instructions) }),
      ...(patch.icon === undefined ? {} : { icon: truncate(patch.icon.trim(), ICON_MAX) || 'folder' }),
      ...(patch.goal === undefined ? {} : { goal: truncate(patch.goal.trim(), GOAL_MAX) }),
      ...(patch.notify === undefined ? {} : { notify: patch.notify }),
      ...(patch.mainModel === undefined ? {} : { mainModel: patch.mainModel }),
      ...(patch.threadModel === undefined ? {} : { threadModel: patch.threadModel }),
      updatedAt: this.deps.now(),
    }
    await this.deps.store.putProject(next)
    if (patch.title !== undefined && next.title !== project.title) {
      try {
        this.deps.host.rename(next.mainSessionId, next.title)
      } catch {
        // The main conversation keeps its old title; the project still renames.
      }
    }
    this.changed()
    return next
  }

  async setPinned(id: string, pinned: boolean): Promise<ProjectRecord> {
    const next = { ...this.require(id), pinned, updatedAt: this.deps.now() }
    await this.deps.store.putProject(next)
    this.changed()
    return next
  }

  /**
   * Archive the project with its main conversation and threads (DSH archives the sessions: they
   * leave the sidebar and cannot run; nothing is deleted). Refused while a thread is running.
   */
  async archive(id: string): Promise<ProjectRecord> {
    const project = this.require(id)
    const threads = this.deps.store.threadsOf(project.mainSessionId)
    if (threads.some((t) => t.status === 'running' || t.status === 'starting')) {
      throw new ProjectError(msg().archiveWhileRunning)
    }
    try {
      await this.deps.host.archiveSession(project.mainSessionId)
    } catch (error) {
      throw new ProjectError(msg().mainBusy(error instanceof Error ? error.message : String(error)))
    }
    for (const thread of threads) {
      // A thread whose session was deleted in DSH is simply skipped.
      await this.deps.host.archiveSession(thread.id).catch(() => {})
    }
    const next = { ...project, archived: true, pinned: false, updatedAt: this.deps.now() }
    await this.deps.store.putProject(next)
    this.changed()
    return next
  }

  async unarchive(id: string): Promise<ProjectRecord> {
    const project = this.require(id)
    // Threads the user archived on their own stay archived.
    const threads = this.deps.store.threadsOf(project.mainSessionId).filter((t) => !t.archived)
    for (const sessionId of [project.mainSessionId, ...threads.map((t) => t.id)]) {
      await this.deps.host.unarchiveSession(sessionId).catch(() => {})
    }
    const next = { ...project, archived: false, updatedAt: this.deps.now() }
    await this.deps.store.putProject(next)
    this.changed()
    return next
  }

  /** Token usage of the main conversation and every thread ("使用情况" in the settings). */
  async usage(id: string): Promise<ProjectUsage> {
    const project = this.require(id)
    const sessions = [
      { sessionId: project.mainSessionId, kind: 'main' as const, n: null, title: project.title },
      ...this.deps.store.threadsOf(project.mainSessionId).map((t) => ({ sessionId: t.id, kind: 'thread' as const, n: t.n, title: t.title })),
    ]
    const rows: UsageRow[] = []
    for (const session of sessions) {
      const buckets = await this.deps.host.sessionUsage(session.sessionId).catch(() => null)
      const input = buckets === null ? 0 : buckets.uncachedInputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens
      rows.push({ ...session, input, output: buckets?.outputTokens ?? 0 })
    }
    const [main, ...threads] = rows
    threads.sort((a, b) => (b.input + b.output) - (a.input + a.output))
    const ordered = main === undefined ? threads : [main, ...threads]
    return {
      total: { input: ordered.reduce((sum, row) => sum + row.input, 0), output: ordered.reduce((sum, row) => sum + row.output, 0) },
      rows: ordered,
    }
  }

  /** Forget the project. Its main conversation and threads stay as ordinary sessions. Refused while a thread is running. */
  async remove(id: string): Promise<void> {
    const project = this.require(id)
    if (this.deps.store.threadsOf(project.mainSessionId).some((t) => t.status === 'running' || t.status === 'starting')) {
      throw new ProjectError(msg().deleteWhileRunning)
    }
    await this.deps.store.removeProject(id)
    this.changed()
  }
}
