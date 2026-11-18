import { beforeEach, describe, expect, it } from 'vitest'
import { apiHandlers } from '../src/api.ts'
import type { ThreadManager } from '../src/manager.ts'
import { roleOf } from '../src/roles.ts'
import { ProjectError, type ProjectHost, Projects } from '../src/projects.ts'
import { memoryStore, type ThreadStore } from '../src/store.ts'

function setup() {
  const store: ThreadStore = memoryStore()
  const created: string[] = []
  const renamed: string[] = []
  const threads = new Set<string>()
  const archived = new Set<string>()
  const busy = new Set<string>()
  const applied: string[] = []
  const usage = new Map<string, { uncachedInputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }>()
  const workspaces = new Map([['ws-1', { id: 'ws-1', path: '/code/app', sessions: ['existing'] }]])
  const switched: string[] = []
  const entered: string[] = []
  const host: ProjectHost = {
    async createMainSession(workspaceId, title) {
      const id = `session-main-${created.length + 1}`
      created.push(`${workspaceId}:${title}`)
      workspaces.get(workspaceId)?.sessions.push(id)
      return id
    },
    workspace: (id) => {
      const ws = workspaces.get(id)
      return ws === undefined ? undefined : { id: ws.id, path: ws.path }
    },
    workspaceOf: (sessionId) => {
      const ws = [...workspaces.values()].find((candidate) => candidate.sessions.includes(sessionId))
      return ws === undefined ? undefined : { id: ws.id, path: ws.path }
    },
    rename: (sessionId, title) => { renamed.push(`${sessionId}:${title}`) },
    async archiveSession(sessionId) {
      if (busy.has(sessionId)) throw new Error('workspace/session-active')
      archived.add(sessionId)
    },
    async unarchiveSession(sessionId) { archived.delete(sessionId) },
    async applyModel(sessionId, choice) {
      if (choice?.model === 'missing') throw new Error('session/model-unavailable')
      applied.push(`${sessionId}:${choice === null ? 'default' : choice.model}`)
    },
    async sessionUsage(sessionId) { return usage.get(sessionId) ?? null },
    async ensureWorkspace(folder) {
      if (folder === '/missing') throw new Error('not a directory')
      const existing = [...workspaces.values()].find((ws) => ws.path === folder)
      if (existing !== undefined) return { id: existing.id, path: existing.path }
      const id = `ws-${workspaces.size + 1}`
      workspaces.set(id, { id, path: folder, sessions: [] })
      return { id, path: folder }
    },
    async checkFolder(folder) {
      if (folder === '/missing') throw new Error('ENOENT: no such file or directory')
      // A real host canonicalizes; the fake keeps the path it was given.
      return folder.endsWith('/') ? folder.slice(0, -1) : folder
    },
    async switchFolder(workspaceId, folder) {
      // DSH's registry keeps the workspace it loaded for the life of the process, so the old path
      // stays until a restart: the tests move it themselves to simulate one.
      if (workspaces.get(workspaceId) === undefined) throw new Error('workspace not found')
      switched.push(`${workspaceId}:${folder}`)
      return folder
    },
    async enterFolder(sessionId, folder) { entered.push(`${sessionId}:${folder}`) },
  }
  let clock = 0
  let ids = 0
  const projects = new Projects({
    store,
    host,
    isThread: (id) => threads.has(id),
    now: () => new Date(Date.UTC(2026, 9, 23, 0, 0, clock++)).toISOString(),
    newProjectId: () => `project-${++ids}`,
  })
  let changes = 0
  projects.onChange(() => { changes += 1 })
  return { store, projects, created, renamed, threads, archived, busy, applied, usage, workspaces, switched, entered, changes: () => changes }
}

function threadOf(mainSessionId: string, id: string, status: 'idle' | 'running') {
  return {
    id, mainSessionId, n: 1, title: 't', task: 'x', initiation: 'user_asked' as const, status, resolved: false, archived: false,
    round: status === 'running' ? 'dispatch' as const : null, userMessages: [], roundStartSeq: 0, roundStartedAt: null,
    lastReport: null, error: null, worktree: null, reminder: null, stopped: false, lastRound: null, late: false, createdAt: '', updatedAt: '',
  }
}

describe('Projects', () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => { t = setup() })

  it('creates a project with a new main conversation in the chosen folder', async () => {
    const project = await t.projects.create({ title: '  Vetoarc  ', workspaceId: 'ws-1', instructions: '用中文回复' })
    expect(t.created).toEqual(['ws-1:Vetoarc'])
    expect(project).toMatchObject({ title: 'Vetoarc', folder: '/code/app', mainSessionId: 'session-main-1', pinned: false, instructions: '用中文回复' })
    expect(t.projects.ofMain('session-main-1')?.id).toBe(project.id)
    expect(t.changes()).toBe(1)
  })

  it('creates a project from a folder path, adding the workspace when needed', async () => {
    const project = await t.projects.create({ title: 'New', folder: '/code/new' })
    expect(project).toMatchObject({ workspaceId: 'ws-2', folder: '/code/new' })
    expect((await t.projects.create({ title: 'Same', folder: '/code/app' })).workspaceId).toBe('ws-1')
    await expect(t.projects.create({ title: 'x', folder: 'relative/dir' })).rejects.toBeInstanceOf(ProjectError)
    await expect(t.projects.create({ title: 'x', folder: '/missing' })).rejects.toBeInstanceOf(ProjectError)
  })

  it('turns an existing conversation into a project, once', async () => {
    const first = await t.projects.create({ title: 'A', fromSessionId: 'existing' })
    const again = await t.projects.create({ title: 'B', fromSessionId: 'existing' })
    expect(again.id).toBe(first.id)
    expect(t.created).toEqual([])
    expect(t.store.projects()).toHaveLength(1)
  })

  it('refuses threads, sessions outside a workspace, empty titles and missing folders', async () => {
    t.threads.add('thread-1')
    await expect(t.projects.create({ title: 'A', fromSessionId: 'thread-1' })).rejects.toBeInstanceOf(ProjectError)
    await expect(t.projects.create({ title: 'A', fromSessionId: 'nowhere' })).rejects.toBeInstanceOf(ProjectError)
    await expect(t.projects.create({ title: '   ', workspaceId: 'ws-1' })).rejects.toBeInstanceOf(ProjectError)
    await expect(t.projects.create({ title: 'A' })).rejects.toBeInstanceOf(ProjectError)
  })

  it('renames the main conversation with the project, pins, and forgets on remove', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await t.projects.update(project.id, { title: 'B' })
    expect(t.renamed).toEqual(['session-main-1:B'])
    expect((await t.projects.setPinned(project.id, true)).pinned).toBe(true)
    await t.projects.remove(project.id)
    expect(t.store.projects()).toEqual([])
    expect(t.changes()).toBe(4)
  })

  it('refuses to delete while a thread runs', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await t.store.putThread(threadOf('session-main-1', 'session-t1', 'running'))
    await expect(t.projects.remove(project.id)).rejects.toBeInstanceOf(ProjectError)
    await t.store.putThread(threadOf('session-main-1', 'session-t1', 'idle'))
    await t.projects.remove(project.id)
    expect(t.store.projects()).toEqual([])
  })

  it('stops hiding and locking a deleted project\'s threads', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await t.store.putThread({ ...threadOf('session-main-1', 'session-t1', 'idle'), resolved: true })
    const api = apiHandlers({
      projects: t.projects,
      manager: { isThread: (id: string) => t.store.thread(id) !== undefined } as unknown as ThreadManager,
      threadsOf: (main) => t.store.threadsOf(main),
      thread: (id) => t.store.thread(id),
      threads: () => t.store.threads(),
      plugin: { name: 'p', version: '0' },
      modelCatalog: async () => null,
      lastReply: () => undefined,
    })
    const kinds = () => api['sessions.kinds']!(undefined) as { threads: string[]; mains: { id: string }[] }
    expect(kinds().threads).toEqual(['session-t1'])
    expect(api['threads.resolved']!(undefined)).toEqual(['session-t1'])
    await t.projects.remove(project.id)
    expect(kinds()).toEqual({ threads: [], mains: [] })
    expect(api['threads.resolved']!(undefined)).toEqual([])
  })

  it('gives new projects defaults and updates icon, goal and notifications', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    expect(project).toMatchObject({ icon: 'folder', goal: '', archived: false, notify: 'attention', mainModel: null, threadModel: null })
    const next = await t.projects.update(project.id, { icon: 'scale', goal: '  把 p95 降到 200ms  ', notify: 'waiting' })
    expect(next).toMatchObject({ icon: 'scale', goal: '把 p95 降到 200ms', notify: 'waiting' })
    expect((await t.projects.update(project.id, { icon: ' ' })).icon).toBe('folder')
  })

  it('archives the main conversation and its threads, and unarchives them back', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await t.projects.setPinned(project.id, true)
    await t.store.putThread(threadOf('session-main-1', 'session-t1', 'idle'))
    const archived = await t.projects.archive(project.id)
    expect(archived).toMatchObject({ archived: true, pinned: false })
    expect([...t.archived].sort()).toEqual(['session-main-1', 'session-t1'])

    expect((await t.projects.unarchive(project.id)).archived).toBe(false)
    expect(t.archived.size).toBe(0)
  })

  it('leaves a thread the user archived on its own archived, and out of the counts', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await t.store.putThread(threadOf('session-main-1', 'session-t1', 'idle'))
    await t.store.putThread({ ...threadOf('session-main-1', 'session-t2', 'idle'), n: 2, archived: true })
    t.archived.add('session-t2')
    expect(t.projects.list()[0]?.threads).toBe(1)
    await t.projects.archive(project.id)
    await t.projects.unarchive(project.id)
    expect([...t.archived]).toEqual(['session-t2'])
  })

  it('refuses to archive while a thread runs or the main conversation is busy', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await t.store.putThread(threadOf('session-main-1', 'session-t1', 'running'))
    await expect(t.projects.archive(project.id)).rejects.toBeInstanceOf(ProjectError)
    await t.store.putThread(threadOf('session-main-1', 'session-t1', 'idle'))
    t.busy.add('session-main-1')
    await expect(t.projects.archive(project.id)).rejects.toBeInstanceOf(ProjectError)
    expect(t.archived.size).toBe(0)
    expect(t.store.project(project.id)?.archived).toBe(false)
  })

  it('applies the coordinator model to the main conversation, and keeps the record when DSH refuses it', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    const flash = { provider: 'deepseek', model: 'deepseek-flash', reasoningEffort: 'high' }
    expect((await t.projects.update(project.id, { mainModel: flash })).mainModel).toEqual(flash)
    await t.projects.update(project.id, { mainModel: flash })
    await t.projects.update(project.id, { mainModel: null })
    expect(t.applied).toEqual(['session-main-1:deepseek-flash', 'session-main-1:default'])
    await expect(t.projects.update(project.id, { mainModel: { provider: 'deepseek', model: 'missing' } })).rejects.toBeInstanceOf(ProjectError)
    expect(t.store.project(project.id)?.mainModel).toBeNull()
    // The thread model is only stored; threads pick it up when they open.
    expect((await t.projects.update(project.id, { threadModel: flash })).threadModel).toEqual(flash)
    expect(t.applied).toHaveLength(2)
  })

  it('sums usage: main conversation first, then threads by size', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await t.store.putThread({ ...threadOf('session-main-1', 'session-t1', 'idle'), n: 1, title: 'small' })
    await t.store.putThread({ ...threadOf('session-main-1', 'session-t2', 'idle'), n: 2, title: 'big' })
    t.usage.set('session-main-1', { uncachedInputTokens: 100, outputTokens: 10, cacheReadTokens: 50, cacheWriteTokens: 0 })
    t.usage.set('session-t1', { uncachedInputTokens: 10, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 })
    t.usage.set('session-t2', { uncachedInputTokens: 900, outputTokens: 90, cacheReadTokens: 0, cacheWriteTokens: 9 })
    const usage = await t.projects.usage(project.id)
    expect(usage.rows.map((row) => [row.kind, row.title, row.input, row.output])).toEqual([
      ['main', 'A', 150, 10],
      ['thread', 'big', 909, 90],
      ['thread', 'small', 10, 1],
    ])
    expect(usage.total).toEqual({ input: 1069, output: 101 })
  })

  it('summarizes thread counts and the latest activity', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await t.store.putThread({
      id: 'session-t1', mainSessionId: project.mainSessionId, n: 1, title: 't', task: 'x', initiation: 'user_asked',
      status: 'running', resolved: false, archived: false, round: 'dispatch', userMessages: [], roundStartSeq: 0, roundStartedAt: null,
      lastReport: null, error: null, worktree: null, reminder: null, stopped: false, lastRound: null, late: false, createdAt: '', updatedAt: '2030-01-01T00:00:00.000Z',
    })
    expect(t.projects.list()[0]).toMatchObject({ threads: 1, running: 1, lastActivity: '2030-01-01T00:00:00.000Z' })
    expect(t.projects.ofSession('session-t1')?.id).toBe(project.id)
  })

  // The folder used to be read-only: a project was stuck in the directory it was created in.
  it('moves the project and its DSH workspace to another folder', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    expect(t.projects.list()[0]?.folderPendingRestart).toBe(false)
    const next = await t.projects.update(project.id, { folder: '/code/new' })
    expect(next.folder).toBe('/code/new')
    expect(t.switched).toEqual(['ws-1:/code/new'])
    // The open main conversation follows at once; DSH's own sessions follow after a restart.
    expect(t.entered).toEqual(['session-main-1:/code/new'])
    expect(t.projects.list()[0]?.folderPendingRestart).toBe(true)

    // A restart: DSH loads the record it was given and the two agree again.
    t.workspaces.get('ws-1')!.path = '/code/new'
    expect(t.projects.list()[0]).toMatchObject({ folder: '/code/new', folderPendingRestart: false })
  })

  it('refuses a folder that is empty, relative or missing, and keeps the record', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    for (const folder of ['   ', 'relative/dir', '/missing']) {
      await expect(t.projects.update(project.id, { folder })).rejects.toBeInstanceOf(ProjectError)
    }
    expect(t.store.project(project.id)?.folder).toBe('/code/app')
    expect(t.switched).toEqual([])
    expect(t.entered).toEqual([])
  })

  it('mounts extra folders, canonical and deduplicated, never the project folder itself', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    const next = await t.projects.update(project.id, { extraFolders: [' /data/refs/', '/data/refs', '/code/app', '  ', '/data/docs'] })
    expect(next.extraFolders).toEqual(['/data/refs', '/data/docs'])
    expect((await t.projects.update(project.id, { extraFolders: [] })).extraFolders).toEqual([])
  })

  it('refuses a mounted folder that does not exist, a relative one, and more than the cap', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await expect(t.projects.update(project.id, { extraFolders: ['/missing'] })).rejects.toBeInstanceOf(ProjectError)
    await expect(t.projects.update(project.id, { extraFolders: ['data/refs'] })).rejects.toBeInstanceOf(ProjectError)
    const many = Array.from({ length: 21 }, (_, index) => `/data/${index}`)
    await expect(t.projects.update(project.id, { extraFolders: many })).rejects.toBeInstanceOf(ProjectError)
    expect(t.store.project(project.id)?.extraFolders).toEqual([])
  })
})

describe('roleOf', () => {
  const manager = {
    // 'orphan' is a thread whose project was deleted.
    isProjectThread: (id: string) => id === 'thread',
    isDispatcher: (id: string) => id === 'main',
  }

  it('gives dispatcher tools only to project main conversations', () => {
    expect(roleOf({ id: 'main' }, manager)).toBe('dispatcher')
    expect(roleOf({ id: 'thread' }, manager)).toBe('thread')
    expect(roleOf({ id: 'orphan' }, manager)).toBe('none')
    expect(roleOf({ id: 'plain' }, manager)).toBe('none')
    expect(roleOf({ id: 'main', origin: 'subagent' }, manager)).toBe('none')
  })
})
