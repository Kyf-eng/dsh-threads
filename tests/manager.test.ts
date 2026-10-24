import { beforeEach, describe, expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import { type ThreadAgent, type ThreadHost, ThreadError, ThreadManager } from '../src/manager.ts'
import type { NoticeMeta } from '../src/source.ts'
import { memoryStore, type ThreadStore } from '../src/store.ts'
import type { ThreadWorktree } from '../src/types.ts'
import { WorktreeError } from '../src/worktree.ts'

class FakeAgent implements ThreadAgent {
  status: 'idle' | 'running' = 'idle'
  seq = 0
  followups: string[] = []
  injects: string[] = []
  metas: (NoticeMeta | undefined)[] = []
  constructor(readonly id: string) {}
  followup(text: string, _summary: string, meta?: NoticeMeta) { this.followups.push(text); this.metas.push(meta) }
  inject(text: string, _summary: string, meta?: NoticeMeta) { this.injects.push(text); this.metas.push(meta) }
}

function setup(overrides: Partial<Config> = {}, options: { slowWrites?: boolean; slowMain?: boolean } = {}) {
  const agents = new Map<string, FakeAgent>()
  const outputs = new Map<string, string>()
  const renamed: string[] = []
  const inherited: string[] = []
  let failCreate = false
  let notARepo = false
  const entered: string[] = []
  const models: string[] = []
  const removals = new Map<string, { outcome: 'removed' | 'missing' | 'dirty'; branchKept: boolean }>()
  const host: ThreadHost = {
    async createSession(_main, id) {
      if (failCreate) throw new Error('create failed')
      const agent = new FakeAgent(id)
      agents.set(id, agent)
      return agent
    },
    async resolve(id) {
      if (options.slowMain === true && id === 'main') await new Promise((resolve) => setTimeout(resolve, 5))
      return agents.get(id)
    },
    rename(id, title) { renamed.push(`${id}:${title}`) },
    inheritPermission(main, thread) { inherited.push(`${main}->${thread}`) },
    roundOutput(id) { return outputs.get(id) },
    async createWorktree(_main, name) {
      if (notARepo) throw new WorktreeError('not a git repository')
      return { path: `/repo/.agents/worktrees/dsh-threads-${name}`, branch: `dsh-threads/${name}`, baseCommit: 'abc1234def', repositoryRoot: '/repo', removed: false }
    },
    async enterDirectory(id, path) { entered.push(`${id}:${path}`) },
    async removeWorktree(worktree: ThreadWorktree) { return removals.get(worktree.branch) ?? { outcome: 'removed', branchKept: false } },
    async applyModel(id, choice) {
      if (choice.model === 'missing') throw new Error('session/model-unavailable')
      models.push(`${id}:${choice.provider}/${choice.model}`)
    },
  }
  const main = new FakeAgent('main')
  agents.set('main', main)
  const memory = memoryStore()
  // A store whose thread writes land a tick later, like a real storage backend may.
  const store: ThreadStore = options.slowWrites === true
    ? { ...memory, putThread: async (record) => { await new Promise((resolve) => setTimeout(resolve, 0)); await memory.putThread(record) } }
    : memory
  let clock = 0
  let ids = 0
  const manager = new ThreadManager({
    store,
    host,
    // The report reminder has its own tests; elsewhere a round settles on its first idle.
    config: { ...Config({}), reportReminder: false, ...overrides },
    now: () => new Date(Date.UTC(2026, 9, 23, 0, 0, clock++)).toISOString(),
    newSessionId: () => `session-${++ids}`,
    newProposalId: () => `proposal-${++ids}`,
    warn: () => {},
  })
  // 'main' is a project's main conversation; only those dispatch threads.
  void store.putProject({
    id: 'project-1', title: 'P', workspaceId: 'ws', folder: '/tmp/p', mainSessionId: 'main',
    pinned: false, instructions: '', icon: 'folder', goal: '', archived: false, notify: 'attention',
    mainModel: null, threadModel: null, createdAt: '', updatedAt: '',
  })
  return { manager, store, main, agents, outputs, renamed, inherited, entered, removals, models, failCreate: () => { failCreate = true }, notARepo: () => { notARepo = true } }
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
    t = setup({ maxRunning: 1 })
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

  it('reports a round the user drove in the thread quietly, quoting what they asked', async () => {
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.onIdle('session-1')
    await t.manager.onInbox('session-1', 'user', 10, '困难模式再快一点')
    await t.manager.onInbox('session-1', 'user', 12, '起步 60ms')
    expect(t.store.thread('session-1')).toMatchObject({ status: 'running', round: 'user', roundStartSeq: 10, userMessages: ['困难模式再快一点', '起步 60ms'] })
    await t.manager.onIdle('session-1')
    expect(t.main.followups).toHaveLength(1)
    expect(t.main.injects).toHaveLength(1)
    expect(t.main.injects[0]).toContain('用户的原话：「困难模式再快一点」 「起步 60ms」')
    expect(t.store.thread('session-1')?.userMessages).toEqual([])
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

  it('treats a deleted project\'s threads as ordinary conversations', async () => {
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.onIdle('session-1')
    expect(t.manager.isProjectThread('session-1')).toBe(true)
    await t.store.removeProject('project-1')
    expect(t.manager.isThread('session-1')).toBe(true)
    expect(t.manager.isProjectThread('session-1')).toBe(false)
    // The user talking there no longer starts a round that reports to the old main conversation.
    await t.manager.onInbox('session-1', 'user', 10, 'hi')
    await t.manager.onIdle('session-1')
    expect(t.store.thread('session-1')).toMatchObject({ status: 'idle', round: null })
    expect(t.main.injects).toHaveLength(0)
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

describe('thread model', () => {
  it("opens threads on the project's thread model, and on the default when DSH cannot use it", async () => {
    const t = setup()
    const project = t.store.projectOfMain('main')!
    await t.store.putProject({ ...project, threadModel: { provider: 'deepseek', model: 'deepseek-pro', reasoningEffort: 'high' } })
    await t.manager.open('main', { title: 'a', task: 'a', initiation: 'user_asked' })
    expect(t.models).toEqual(['session-1:deepseek/deepseek-pro'])

    await t.store.putProject({ ...project, threadModel: { provider: 'deepseek', model: 'missing' } })
    const thread = await t.manager.open('main', { title: 'b', task: 'b', initiation: 'user_asked' })
    expect(thread.status).toBe('running')
  })
})

describe('wake streak', () => {
  it('resets when the user speaks, even while a delivery to the main conversation is in flight', async () => {
    const t = setup({}, { slowMain: true })
    await t.store.putMain({ ...t.store.main('main'), autoWakeStreak: 2 })
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    const settling = t.manager.onIdle('session-1')
    // The delivery is waiting to reach the main conversation when the user speaks there.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await t.manager.onInbox('main', 'user', 5)
    await settling
    expect(t.main.followups).toHaveLength(1)
    expect(t.store.main('main').autoWakeStreak).toBe(0)
  })
})

describe('report reminder', () => {
  it('asks a thread once to report, keeps the round open, and delivers the report it then sends', async () => {
    const t = setup({ reportReminder: true })
    await t.manager.open('main', { title: '查依赖', task: 'x', initiation: 'user_asked' })
    t.outputs.set('session-1', '做完了')
    await t.manager.onIdle('session-1')
    const thread = t.agents.get('session-1')!
    expect(thread.followups[1]).toContain('没有调用 thread_report')
    expect(thread.metas[1]?.role).toBe('reminder')
    expect(t.store.thread('session-1')).toMatchObject({ status: 'running', round: 'dispatch', reminder: { fallback: '做完了' } })
    expect(t.main.followups).toHaveLength(0)

    await t.manager.recordReport('session-1', { status: 'done', summary: '有 3 个过期依赖', changedFiles: [], decisions: [] })
    await t.manager.onIdle('session-1')
    expect(t.main.followups[0]).toContain('有 3 个过期依赖')
    expect(t.store.thread('session-1')).toMatchObject({ status: 'idle', round: null, reminder: null })
  })

  it('falls back to the reply from before the reminder when the thread still does not report', async () => {
    const t = setup({ reportReminder: true })
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    t.outputs.set('session-1', '真正的结果')
    await t.manager.onIdle('session-1')
    t.outputs.set('session-1', '好的')
    await t.manager.onIdle('session-1')
    expect(t.agents.get('session-1')!.followups).toHaveLength(2)
    expect(t.main.followups[0]).toContain('真正的结果')
    expect(t.main.followups[0]).not.toContain('好的')
  })

  it('does not remind after a round the user drove in the thread', async () => {
    const t = setup({ reportReminder: true })
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.recordReport('session-1', { status: 'done', summary: 'ok', changedFiles: [], decisions: [] })
    await t.manager.onIdle('session-1')
    await t.manager.onInbox('session-1', 'user', 10)
    await t.manager.onIdle('session-1')
    expect(t.agents.get('session-1')!.followups).toHaveLength(1)
    expect(t.main.injects).toHaveLength(1)
  })
})

describe('parallel threads', () => {
  it('runs up to three threads at once by default', async () => {
    const t = setup()
    for (const title of ['a', 'b', 'c']) await t.manager.open('main', { title, task: title, initiation: 'user_asked' })
    expect(t.manager.runningCount('main')).toBe(3)
    await expect(t.manager.open('main', { title: 'd', task: 'd', initiation: 'user_asked' })).rejects.toBeInstanceOf(ThreadError)
  })

  it('keeps the limit and the numbering when opens arrive at the same moment', async () => {
    const t = setup({ maxRunning: 2 }, { slowWrites: true })
    const results = await Promise.allSettled(['a', 'b', 'c'].map((title) => t.manager.open('main', { title, task: title, initiation: 'user_asked' })))
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'rejected'])
    expect(t.store.threadsOf('main').map((thread) => thread.n)).toEqual([1, 2])
  })

  it('holds reports until every thread is done, even when two finish at the same moment', async () => {
    const t = setup({}, { slowMain: true })
    await t.manager.open('main', { title: 'a', task: 'a', initiation: 'user_asked' })
    await t.manager.open('main', { title: 'b', task: 'b', initiation: 'user_asked' })
    const first = t.manager.onIdle('session-1')
    // b finishes while a's report is still on its way to the main conversation.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.all([first, t.manager.onIdle('session-2')])
    expect(t.main.followups).toHaveLength(1)
    expect(t.main.metas[0]?.threads.map((card) => card.title)).toEqual(['a', 'b'])
  })

  it('starts each queued proposal once when two threads free their slots together', async () => {
    const t = setup({ maxRunning: 2 })
    const proposals = await t.manager.propose('main', [{ title: 'A', task: 'a' }, { title: 'B', task: 'b' }, { title: 'C', task: 'c' }])
    await t.manager.startProposals('main', proposals.map((p) => p.id))
    const [first, second] = t.store.threadsOf('main')
    await Promise.all([t.manager.onIdle(first!.id), t.manager.onIdle(second!.id)])
    expect(t.store.threadsOf('main').map((thread) => thread.title)).toEqual(['A', 'B', 'C'])
    expect(t.manager.runningCount('main')).toBe(1)
    expect(t.main.followups).toHaveLength(0)
  })
})

describe('worktrees', () => {
  it('opens a thread in its own worktree: branch on the record, the card and the report', async () => {
    const t = setup()
    const thread = await t.manager.open('main', { title: '改 README', task: 'x', initiation: 'user_asked', worktree: true })
    expect(thread.worktree).toMatchObject({ branch: 'dsh-threads/1-1', path: '/repo/.agents/worktrees/dsh-threads-1-1' })
    expect(t.entered).toEqual(['session-1:/repo/.agents/worktrees/dsh-threads-1-1'])
    expect(t.manager.worktreeOf('session-1')?.branch).toBe('dsh-threads/1-1')
    expect(t.agents.get('session-1')?.metas[0]?.threads[0]?.branch).toBe('dsh-threads/1-1')

    await t.manager.onIdle('session-1')
    expect(t.main.followups[0]).toContain('分支：dsh-threads/1-1')
  })

  it('refuses without creating a session when the folder is not a repository', async () => {
    const t = setup()
    t.notARepo()
    await expect(t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked', worktree: true })).rejects.toBeInstanceOf(ThreadError)
    expect(t.agents.has('session-1')).toBe(false)
    expect(t.store.threadsOf('main')).toEqual([])
  })

  it('cleans up finished worktrees only, keeping dirty ones', async () => {
    const t = setup()
    await t.manager.open('main', { title: 'a', task: 'a', initiation: 'user_asked', worktree: true })
    await t.manager.open('main', { title: 'b', task: 'b', initiation: 'user_asked', worktree: true })
    await t.manager.open('main', { title: 'c', task: 'c', initiation: 'user_asked', worktree: true })
    await t.manager.onIdle('session-1')
    await t.manager.onIdle('session-2')
    t.removals.set('dsh-threads/2-2', { outcome: 'dirty', branchKept: true })

    expect(t.manager.cleanupCandidates('main').map((thread) => thread.n)).toEqual([1, 2])
    const lines = await t.manager.cleanupWorktrees('main')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('没提交的改动')
    expect(t.store.thread('session-1')?.worktree?.removed).toBe(true)
    expect(t.store.thread('session-2')?.worktree?.removed).toBe(false)
    expect(t.manager.worktreeOf('session-1')).toBeNull()
  })

  it('carries the worktree choice through a proposal', async () => {
    const t = setup()
    const [p] = await t.manager.propose('main', [{ title: 'A', task: 'a', worktree: true }])
    await t.manager.startProposals('main', [p!.id])
    expect(t.store.thread('session-2')?.worktree?.branch).toBe('dsh-threads/1-2')
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

describe('thread cards on notices', () => {
  it('tags the brief and the report with the thread card', async () => {
    const t = setup()
    await t.manager.open('main', { title: '查依赖', task: 'x', initiation: 'user_asked' })
    expect(t.agents.get('session-1')?.metas[0]).toEqual({ role: 'brief', threads: [{ threadId: 'session-1', n: 1, title: '查依赖' }], wake: true })
    await t.manager.recordReport('session-1', { status: 'needs_decision', summary: '要不要升级', changedFiles: ['package.json'], decisions: ['升级?'] })
    await t.manager.onIdle('session-1')
    expect(t.main.metas[0]).toEqual({
      role: 'report',
      threads: [{ threadId: 'session-1', n: 1, title: '查依赖', status: 'needs_decision', summary: '要不要升级', decision: '升级?', files: ['package.json'] }],
      wake: true,
    })
  })
})

describe('proposals', () => {
  it('stores up to maxProposalsPerTurn proposals, only for a project main conversation', async () => {
    const t = setup({ maxProposalsPerTurn: 2 })
    const created = await t.manager.propose('main', [{ title: 'A', task: 'do a' }, { title: '', task: 'do b\nmore' }])
    expect(created.map((p) => [p.title, p.state])).toEqual([['A', 'pending'], ['do b', 'pending']])
    expect(t.manager.proposals('main')).toHaveLength(2)
    await expect(t.manager.propose('main', [{ title: 'a', task: 'a' }, { title: 'b', task: 'b' }, { title: 'c', task: 'c' }])).rejects.toBeInstanceOf(ThreadError)
    await expect(t.manager.propose('other', [{ title: 'a', task: 'a' }])).rejects.toBeInstanceOf(ThreadError)
  })

  it('starts what fits under maxRunning and queues the rest until a thread finishes', async () => {
    const t = setup({ maxRunning: 1 })
    const [a, b] = await t.manager.propose('main', [{ title: 'A', task: 'do a' }, { title: 'B', task: 'do b' }])
    const result = await t.manager.startProposals('main', [a!.id, b!.id])
    expect(result.map((p) => p.state)).toEqual(['started', 'queued'])
    expect(t.store.thread('session-3')).toMatchObject({ initiation: 'proposal', title: 'A' })

    await t.manager.onIdle('session-3')
    expect(t.store.proposal(b!.id)).toMatchObject({ state: 'started' })
    expect(t.manager.runningCount('main')).toBe(1)
    // A's report waits for B, which the queue started, so the batch arrives as one wake-up.
    expect(t.main.followups).toHaveLength(0)
    await t.manager.onIdle('session-4')
    expect(t.main.followups).toHaveLength(1)
    expect(t.main.metas[0]?.threads.map((card) => card.title)).toEqual(['A', 'B'])
  })

  it('dismisses proposals and drops expired ones from the list', async () => {
    const t = setup({ proposalTtlDays: 1 })
    const [a, b] = await t.manager.propose('main', [{ title: 'A', task: 'a' }, { title: 'B', task: 'b' }])
    await t.manager.dismissProposals('main', [a!.id])
    expect(t.manager.proposals('main').map((p) => p.id)).toEqual([b!.id])
    await t.store.putProposal({ ...b!, expiresAt: '2000-01-01T00:00:00.000Z' })
    expect(t.manager.proposals('main')).toEqual([])
  })
})
