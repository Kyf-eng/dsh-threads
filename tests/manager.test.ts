import { beforeEach, describe, expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import { type ThreadAgent, type ThreadHost, ThreadError, ThreadManager } from '../src/manager.ts'
import { memoryStore, type ThreadStore } from '../src/store.ts'

class FakeAgent implements ThreadAgent {
  status: 'idle' | 'running' = 'idle'
  seq = 0
  followups: string[] = []
  injects: string[] = []
  constructor(readonly id: string) {}
  followup(text: string) { this.followups.push(text) }
  inject(text: string) { this.injects.push(text) }
}

function setup(overrides: Partial<Config> = {}) {
  const agents = new Map<string, FakeAgent>()
  const outputs = new Map<string, string>()
  const renamed: string[] = []
  const inherited: string[] = []
  let failCreate = false
  const host: ThreadHost = {
    async createSession(_main, id) {
      if (failCreate) throw new Error('create failed')
      const agent = new FakeAgent(id)
      agents.set(id, agent)
      return agent
    },
    async resolve(id) { return agents.get(id) },
    rename(id, title) { renamed.push(`${id}:${title}`) },
    inheritPermission(main, thread) { inherited.push(`${main}->${thread}`) },
    roundOutput(id) { return outputs.get(id) },
  }
  const main = new FakeAgent('main')
  agents.set('main', main)
  const store: ThreadStore = memoryStore()
  let clock = 0
  let ids = 0
  const manager = new ThreadManager({
    store,
    host,
    config: { ...Config({}), ...overrides },
    now: () => new Date(Date.UTC(2026, 9, 23, 0, 0, clock++)).toISOString(),
    newSessionId: () => `session-${++ids}`,
    warn: () => {},
  })
  // 'main' is a project's main conversation; only those dispatch threads.
  void store.putProject({
    id: 'project-1', title: 'P', workspaceId: 'ws', folder: '/tmp/p', mainSessionId: 'main',
    pinned: false, instructions: '', createdAt: '', updatedAt: '',
  })
  return { manager, store, main, agents, outputs, renamed, inherited, failCreate: () => { failCreate = true } }
}

describe('ThreadManager', () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => { t = setup() })

  it('opens a thread: record, title, inherited preset, and the brief sent as a dispatch round', async () => {
    const thread = await t.manager.open('main', { title: '查依赖', task: '列出过期依赖', initiation: 'user_asked' })
    expect(thread).toMatchObject({ n: 1, status: 'running', round: 'dispatch', mainSessionId: 'main' })
    expect(t.renamed).toEqual(['session-1:#1 查依赖'])
    expect(t.inherited).toEqual(['main->session-1'])
    expect(t.agents.get('session-1')?.followups[0]).toContain('列出过期依赖')
    expect(t.manager.isThread('session-1')).toBe(true)
  })

  it('refuses beyond maxRunning, and refuses from inside a thread', async () => {
    await t.manager.open('main', { title: 'a', task: 'a', initiation: 'user_asked' })
    await expect(t.manager.open('main', { title: 'b', task: 'b', initiation: 'user_asked' })).rejects.toBeInstanceOf(ThreadError)
    await expect(t.manager.open('session-1', { title: 'c', task: 'c', initiation: 'user_asked' })).rejects.toBeInstanceOf(ThreadError)
  })

  it('marks the thread failed when its session cannot be created', async () => {
    t.failCreate()
    await expect(t.manager.open('main', { title: 'a', task: 'a', initiation: 'user_asked' })).rejects.toThrow('create failed')
    expect(t.store.thread('session-1')).toMatchObject({ status: 'failed', error: 'Error: create failed' })
  })

  it('reports a finished round to the idle main conversation and wakes it', async () => {
    await t.manager.open('main', { title: '查依赖', task: 'x', initiation: 'user_asked' })
    await t.manager.recordReport('session-1', { status: 'done', summary: '有 3 个过期依赖', changedFiles: [], decisions: [] })
    await t.manager.onIdle('session-1')
    expect(t.store.thread('session-1')).toMatchObject({ status: 'idle', round: null })
    expect(t.main.followups).toHaveLength(1)
    expect(t.main.followups[0]).toContain('有 3 个过期依赖')
    expect(t.store.main('main').autoWakeStreak).toBe(1)
  })

  it('falls back to the last reply when the thread did not report', async () => {
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    t.outputs.set('session-1', '做完了，但忘了回报')
    await t.manager.onIdle('session-1')
    expect(t.main.followups[0]).toContain('做完了，但忘了回报')
  })

  it('holds the note while the main conversation is busy and delivers it when it goes idle', async () => {
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    t.main.status = 'running'
    await t.manager.onIdle('session-1')
    expect(t.main.followups).toHaveLength(0)
    expect(t.store.main('main').pendingNotes).toHaveLength(1)
    t.main.status = 'idle'
    await t.manager.onIdle('main')
    expect(t.main.followups).toHaveLength(1)
    expect(t.store.main('main').pendingNotes).toHaveLength(0)
  })

  it('reports a round the user drove in the thread quietly', async () => {
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.onIdle('session-1')
    await t.manager.onInbox('session-1', 'user', 10)
    expect(t.store.thread('session-1')).toMatchObject({ status: 'running', round: 'user', roundStartSeq: 10 })
    await t.manager.onIdle('session-1')
    expect(t.main.followups).toHaveLength(1)
    expect(t.main.injects).toHaveLength(1)
  })

  it('ignores our own messages and stops waking after maxAutoWakes until the user speaks', async () => {
    t = setup({ maxAutoWakes: 1 })
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.onInbox('session-1', 'dsh-threads', 1)
    expect(t.store.thread('session-1')?.round).toBe('dispatch')
    await t.manager.onIdle('session-1')
    expect(t.main.followups).toHaveLength(1)

    await t.manager.onInbox('session-1', 'user', 5)
    await t.manager.onIdle('session-1')
    await t.manager.open('main', { title: 'b', task: 'y', initiation: 'user_asked' })
    await t.manager.onIdle('session-2')
    expect(t.main.followups).toHaveLength(1)
    expect(t.main.injects).toHaveLength(2)

    await t.manager.onInbox('main', 'user', 0)
    expect(t.store.main('main').autoWakeStreak).toBe(0)
  })

  it('describes threads for thread_status', async () => {
    await t.manager.open('main', { title: '查依赖', task: 'x', initiation: 'offer' })
    expect(t.manager.describe('main')).toContain('#1「查依赖」· running')
    expect(t.manager.describe('main', 1)).toContain('任务：x')
    expect(() => t.manager.describe('main', 9)).toThrow(ThreadError)
  })

  it('only lets a project main conversation open threads', async () => {
    t.agents.set('other', new FakeAgent('other'))
    expect(t.manager.isDispatcher('main')).toBe(true)
    expect(t.manager.isDispatcher('other')).toBe(false)
    await expect(t.manager.open('other', { title: 'a', task: 'a', initiation: 'user_asked' })).rejects.toBeInstanceOf(ThreadError)
  })
})

describe('ThreadManager.reply', () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => { t = setup() })

  it('starts a new dispatched round on an idle thread and reopens it', async () => {
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.onIdle('session-1')
    await t.store.putThread({ ...t.store.thread('session-1')!, resolved: true })
    const thread = t.agents.get('session-1')!
    thread.seq = 42
    await t.manager.reply('main', 1, '再补一个测试')
    expect(t.store.thread('session-1')).toMatchObject({ status: 'running', round: 'dispatch', roundStartSeq: 42, resolved: false })
    expect(thread.followups.at(-1)).toContain('再补一个测试')
  })

  it('upgrades a user-driven round so its result wakes the main conversation', async () => {
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.onIdle('session-1')
    await t.manager.onInbox('session-1', 'user', 5)
    await t.manager.reply('main', 1, '顺便看下 B')
    expect(t.store.thread('session-1')).toMatchObject({ round: 'dispatch', roundStartSeq: 5 })
    await t.manager.onIdle('session-1')
    expect(t.main.followups).toHaveLength(2)
  })

  it('refuses an unknown or unfinished thread', async () => {
    await expect(t.manager.reply('main', 1, 'x')).rejects.toBeInstanceOf(ThreadError)
    t.failCreate()
    await expect(t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })).rejects.toThrow()
    await expect(t.manager.reply('main', 1, 'x')).rejects.toBeInstanceOf(ThreadError)
  })
})

describe('ThreadManager.setResolved', () => {
  it('marks a thread resolved, and a user message in it reopens it', async () => {
    const t = setup()
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.onIdle('session-1')
    expect((await t.manager.setResolved('session-1', true)).resolved).toBe(true)
    await t.manager.onInbox('session-1', 'user', 3)
    expect(t.store.thread('session-1')).toMatchObject({ resolved: false, round: 'user' })
    await expect(t.manager.setResolved('session-x', true)).rejects.toBeInstanceOf(ThreadError)
  })
})

describe('ThreadManager.recover', () => {
  it('fails threads that never started, settles idle ones and reports unreachable ones', async () => {
    const t = setup({ maxRunning: 3 })
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.open('main', { title: 'b', task: 'y', initiation: 'user_asked' })
    await t.manager.recordReport('session-1', { status: 'done', summary: '完成了 a', changedFiles: [], decisions: [] })
    const base = t.store.thread('session-2')!
    await t.store.putThread({ ...base, id: 'session-9', n: 9, status: 'starting', round: null })
    t.agents.delete('session-2')

    await t.manager.recover()

    expect(t.store.thread('session-9')).toMatchObject({ status: 'failed' })
    expect(t.store.thread('session-1')).toMatchObject({ status: 'idle' })
    expect(t.store.thread('session-2')).toMatchObject({ status: 'failed', round: null })
    expect(t.main.followups.join('\n')).toContain('完成了 a')
  })
})
