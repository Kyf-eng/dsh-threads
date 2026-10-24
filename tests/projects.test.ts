import { beforeEach, describe, expect, it } from 'vitest'
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
  const workspaces = new Map([['ws-1', { id: 'ws-1', path: '/code/app', sessions: ['existing'] }]])
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
    async ensureWorkspace(folder) {
      if (folder === '/missing') throw new Error('not a directory')
      const existing = [...workspaces.values()].find((ws) => ws.path === folder)
      if (existing !== undefined) return { id: existing.id, path: existing.path }
      const id = `ws-${workspaces.size + 1}`
      workspaces.set(id, { id, path: folder, sessions: [] })
      return { id, path: folder }
    },
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
  return { store, projects, created, renamed, threads, archived, busy, changes: () => changes }
}

function threadOf(mainSessionId: string, id: string, status: 'idle' | 'running') {
  return {
    id, mainSessionId, n: 1, title: 't', task: 'x', initiation: 'user_asked' as const, status, resolved: false,
    round: status === 'running' ? 'dispatch' as const : null, roundStartSeq: 0, roundStartedAt: null,
    lastReport: null, error: null, worktree: null, reminder: null, createdAt: '', updatedAt: '',
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

  it('summarizes thread counts and the latest activity', async () => {
    const project = await t.projects.create({ title: 'A', workspaceId: 'ws-1' })
    await t.store.putThread({
      id: 'session-t1', mainSessionId: project.mainSessionId, n: 1, title: 't', task: 'x', initiation: 'user_asked',
      status: 'running', resolved: false, round: 'dispatch', roundStartSeq: 0, roundStartedAt: null,
      lastReport: null, error: null, worktree: null, reminder: null, createdAt: '', updatedAt: '2030-01-01T00:00:00.000Z',
    })
    expect(t.projects.list()[0]).toMatchObject({ threads: 1, running: 1, lastActivity: '2030-01-01T00:00:00.000Z' })
    expect(t.projects.ofSession('session-t1')?.id).toBe(project.id)
  })
})

describe('roleOf', () => {
  const manager = {
    isThread: (id: string) => id === 'thread',
    isDispatcher: (id: string) => id === 'main',
  }

  it('gives dispatcher tools only to project main conversations', () => {
    expect(roleOf({ id: 'main' }, manager)).toBe('dispatcher')
    expect(roleOf({ id: 'thread' }, manager)).toBe('thread')
    expect(roleOf({ id: 'plain' }, manager)).toBe('none')
    expect(roleOf({ id: 'main', origin: 'subagent' }, manager)).toBe('none')
  })
})
