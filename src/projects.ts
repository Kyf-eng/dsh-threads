// Projects, as in Claude: one folder (DSH workspace) + one standing main conversation.
// The projects page, the session menu and the /thread gate all go through here.
import { isAbsolute } from 'node:path'
import { truncate } from './report.ts'
import type { ThreadStore } from './store.ts'
import type { NotifyLevel, ProjectRecord } from './types.ts'

const TITLE_MAX = 60
const INSTRUCTIONS_MAX = 4000
const GOAL_MAX = 8000
const ICON_MAX = 40

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
  if (value.length === 0) throw new ProjectError('项目名不能为空。')
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
}

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
        threads: threads.length,
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
      if (this.deps.isThread(input.fromSessionId)) throw new ProjectError('讨论串不能设为项目。')
      workspace = host.workspaceOf(input.fromSessionId)
      if (workspace === undefined) throw new ProjectError('这个会话不在任何工作区里，没法设为项目。')
      mainSessionId = input.fromSessionId
    } else {
      const folder = input.folder?.trim()
      if (folder !== undefined && folder.length > 0) {
        if (!isAbsolute(folder)) throw new ProjectError('文件夹要写完整路径，例如 /Users/me/code/app。')
        try {
          workspace = await host.ensureWorkspace(folder, title)
        } catch (error) {
          throw new ProjectError(`没法用这个文件夹：${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        if (input.workspaceId === undefined) throw new ProjectError('请选择项目的文件夹（工作区）。')
        workspace = host.workspace(input.workspaceId)
        if (workspace === undefined) throw new ProjectError('找不到这个工作区。')
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
    if (project === undefined) throw new ProjectError('找不到这个项目。')
    return project
  }

  async update(id: string, patch: ProjectPatch): Promise<ProjectRecord> {
    const project = this.require(id)
    const next: ProjectRecord = {
      ...project,
      ...(patch.title === undefined ? {} : { title: cleanTitle(patch.title) }),
      ...(patch.instructions === undefined ? {} : { instructions: cleanInstructions(patch.instructions) }),
      ...(patch.icon === undefined ? {} : { icon: truncate(patch.icon.trim(), ICON_MAX) || 'folder' }),
      ...(patch.goal === undefined ? {} : { goal: truncate(patch.goal.trim(), GOAL_MAX) }),
      ...(patch.notify === undefined ? {} : { notify: patch.notify }),
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
      throw new ProjectError('还有讨论串在运行，等它们结束再归档。')
    }
    try {
      await this.deps.host.archiveSession(project.mainSessionId)
    } catch (error) {
      throw new ProjectError(`主对话现在没法归档（可能还在运行）：${error instanceof Error ? error.message : String(error)}`)
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
    for (const sessionId of [project.mainSessionId, ...this.deps.store.threadsOf(project.mainSessionId).map((t) => t.id)]) {
      await this.deps.host.unarchiveSession(sessionId).catch(() => {})
    }
    const next = { ...project, archived: false, updatedAt: this.deps.now() }
    await this.deps.store.putProject(next)
    this.changed()
    return next
  }

  /** Forget the project. Its main conversation and threads stay as ordinary sessions. */
  async remove(id: string): Promise<void> {
    this.require(id)
    await this.deps.store.removeProject(id)
    this.changed()
  }
}
