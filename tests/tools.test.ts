import type { Context } from '@deepseek-ai/cordis'
import { ToolArgsError } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { beforeEach, describe, expect, it } from 'vitest'
import { threadOpenTool } from '../src/tools/thread-open.ts'
import { threadProposeTool } from '../src/tools/thread-propose.ts'
import { threadReplyTool } from '../src/tools/thread-reply.ts'
import { threadReportTool } from '../src/tools/thread-report.ts'
import { threadStatusTool } from '../src/tools/thread-status.ts'
import { setup } from './fixtures.ts'

// The thread_* tools are what the model calls directly: argument checks, refusals it can read, results.

type Answer = { selected: string[]; custom?: string }

/** A DSH context with only the optional userQuestions service, answering every question with `answer`. */
function contextWith(answer: Answer | undefined): { ctx: Context; asked: string[] } {
  const asked: string[] = []
  const questions = {
    async ask(request: { questions: { id: string; question: string }[] }) {
      asked.push(...request.questions.map((q) => q.question))
      return { answers: request.questions.map((q) => ({ id: q.id, ...answer! })) }
    },
  }
  const ctx = {
    get(name: string) {
      if (name === 'userQuestions' && answer !== undefined) return questions
      throw new Error(`service ${name} is not provided`)
    },
  }
  return { ctx: ctx as unknown as Context, asked }
}

const call = (tool: ToolDefinition, args: unknown, agentId = 'main') =>
  tool.execute(args as never, { agent: { id: agentId }, signal: new AbortController().signal, callId: 'call-1' } as never)

describe('thread_open', () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => { t = setup() })

  it('opens a thread the user asked for and returns its card data', async () => {
    const tool = threadOpenTool(contextWith(undefined).ctx, t.manager)
    const result = await call(tool, { title: '查依赖', task: '列出过期依赖', initiation: 'user_asked' }) as { text: string; threadId: string; n: number }
    expect(result).toMatchObject({ threadId: 'session-1', n: 1, title: '查依赖' })
    expect(result.text).toContain('#1「查依赖」')
    expect(tool.output.presentationMeta?.({} as never, result as never)).toEqual({ threadId: 'session-1', n: 1, title: '查依赖' })
  })

  it('rejects arguments the schema does not allow', async () => {
    const tool = threadOpenTool(contextWith(undefined).ctx, t.manager)
    // `proposal` is thread_propose's job; the model may only pass user_asked or offer.
    await expect(call(tool, { title: 'a', task: 'b', initiation: 'proposal' })).rejects.toBeInstanceOf(ToolArgsError)
    await expect(call(tool, { title: 'a', initiation: 'user_asked' })).rejects.toBeInstanceOf(ToolArgsError)
    expect(t.store.threadsOf('main')).toEqual([])
  })

  it('asks the user first for an offer, and opens only on "open a thread"', async () => {
    const open = contextWith({ selected: ['开讨论串'] })
    await call(threadOpenTool(open.ctx, t.manager), { title: '审查', task: 'x', initiation: 'offer' })
    expect(open.asked).toEqual(['要为「审查」开一个讨论串吗？'])
    expect(t.store.threadsOf('main')).toHaveLength(1)

    for (const answer of [{ selected: ['在主对话里做'] }, { selected: ['先不做'] }, { selected: [], custom: '晚点再说' }]) {
      const result = await call(threadOpenTool(contextWith(answer).ctx, t.manager), { title: 'b', task: 'y', initiation: 'offer' }) as { text: string; threadId?: string }
      expect(result.threadId).toBeUndefined()
      expect(result.text).toContain('不要开讨论串')
    }
    expect(t.store.threadsOf('main')).toHaveLength(1)
  })

  it('tells the model to ask in its reply when DSH cannot show the question', async () => {
    const result = await call(threadOpenTool(contextWith(undefined).ctx, t.manager), { title: 'a', task: 'x', initiation: 'offer' }) as { text: string }
    expect(result.text).toContain('userQuestions 不可用')
    expect(t.store.threadsOf('main')).toEqual([])
  })

  it('returns refusals as text the model can act on', async () => {
    t.agents.set('plain', t.main)
    const result = await call(threadOpenTool(contextWith(undefined).ctx, t.manager), { title: 'a', task: 'x', initiation: 'user_asked' }, 'plain') as { text: string }
    expect(result.text).toMatch(/^没有开讨论串：只有项目的主对话能开讨论串/)
  })
})

describe('thread_propose', () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => { t = setup() })

  it('stores suggestions for the proposals card without opening anything', async () => {
    const text = await call(threadProposeTool(t.manager, 3), { items: [{ title: '补测试', task: '给 a 补测试', worktree: true }, { title: '文档', task: '写 b 的文档' }] })
    expect(text).toContain('「补测试」、「文档」')
    expect(t.manager.proposals('main').map((p) => [p.title, p.worktree])).toEqual([['补测试', true], ['文档', false]])
    expect(t.store.threadsOf('main')).toEqual([])
  })

  it('refuses more than the per-turn limit, and items without a brief', async () => {
    t = setup({ maxProposalsPerTurn: 2 })
    const tool = threadProposeTool(t.manager, 2)
    const items = [1, 2, 3].map((i) => ({ title: `t${i}`, task: `task ${i}` }))
    expect(await call(tool, { items })).toContain('一次最多提 2 个')
    expect(await call(tool, { items: [{ title: 'a', task: '   ' }] })).toContain('至少要有一个带完整简报的提议')
    await expect(call(tool, { items: [{ title: 'a' }] })).rejects.toBeInstanceOf(ToolArgsError)
    expect(t.manager.proposals('main')).toEqual([])
  })
})

describe('thread_reply', () => {
  it('sends the instruction to the thread by number and refuses unknown numbers', async () => {
    const t = setup()
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    await t.manager.onIdle('session-1')
    const tool = threadReplyTool(t.manager)
    expect(await call(tool, { n: 1, message: '再加一个用例' })).toContain('已把追加指令发给讨论串 #1')
    expect(t.agents.get('session-1')?.followups.at(-1)).toContain('再加一个用例')
    expect(await call(tool, { n: 7, message: 'x' })).toContain('没有发送：这个主对话没有讨论串 #7')
    await expect(call(tool, { n: '1', message: 'x' })).rejects.toBeInstanceOf(ToolArgsError)
  })
})

describe('thread_status', () => {
  it('lists threads, or one thread in detail', async () => {
    const t = setup()
    const tool = threadStatusTool(t.manager)
    expect(await call(tool, {})).toBe('这个主对话还没有讨论串。')
    await t.manager.open('main', { title: '查依赖', task: '列出过期依赖', initiation: 'user_asked' })
    expect(await call(tool, {})).toContain('#1「查依赖」· running')
    expect(await call(tool, { n: 1 })).toContain('任务：列出过期依赖')
    expect(await call(tool, { n: 2 })).toBe('没有讨论串 #2。')
  })
})

describe('thread_report', () => {
  it('records the round\'s report from a thread', async () => {
    const t = setup()
    await t.manager.open('main', { title: 'a', task: 'x', initiation: 'user_asked' })
    const text = await call(threadReportTool(t.manager, 300), { status: 'needs_decision', summary: '两种做法', decisions: ['用 A 还是 B'] }, 'session-1')
    expect(text).toContain('回报已记录')
    expect(t.store.thread('session-1')?.lastReport).toMatchObject({ status: 'needs_decision', summary: '两种做法', changedFiles: [], decisions: ['用 A 还是 B'] })
  })

  it('refuses sessions that are not threads, and statuses outside the list', async () => {
    const t = setup()
    const tool = threadReportTool(t.manager, 300)
    expect(await call(tool, { status: 'done', summary: 'ok' })).toBe('只有讨论串会话能调用 thread_report。')
    await expect(call(tool, { status: 'finished', summary: 'ok' }, 'session-1')).rejects.toBeInstanceOf(ToolArgsError)
  })
})
