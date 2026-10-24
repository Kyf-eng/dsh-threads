import type { Context } from '@deepseek-ai/cordis'
import { beforeEach, describe, expect, it } from 'vitest'
import { registerThreadCommand } from '../src/command.ts'
import { setup } from './fixtures.ts'

type Result = { kind: 'success' | 'error'; text: string }
type Handler = (input: { agent: { id: string }; rawInput: string }) => Promise<Result>

/** Register /thread on a fake context and return its handler, run as `agentId`. */
function command(manager: ReturnType<typeof setup>['manager']) {
  let handler: Handler | undefined
  let name = ''
  const ctx = { commands: { register: (definition: { name: string; handler: Handler }) => { name = definition.name; handler = definition.handler } } }
  registerThreadCommand(ctx as unknown as Context, manager, '@fky/dsh-threads')
  expect(name).toBe('thread')
  return (rawInput: string, agentId = 'main') => handler!({ agent: { id: agentId }, rawInput })
}

describe('/thread', () => {
  let t: ReturnType<typeof setup>
  let run: ReturnType<typeof command>
  beforeEach(() => {
    t = setup()
    run = command(t.manager)
  })

  it('opens a thread the user asked for, titled from the task\'s first line', async () => {
    const result = await run('  修复构建失败\n日志在 ci.log  ')
    expect(result).toMatchObject({ kind: 'success' })
    expect(result.text).toContain('已开讨论串 #1「修复构建失败」')
    expect(t.store.thread('session-1')).toMatchObject({ initiation: 'user_asked', task: '修复构建失败\n日志在 ci.log', worktree: null })
  })

  it('gives the thread a worktree with -w or --worktree', async () => {
    expect((await run('-w 改 README')).text).toContain('（分支 dsh-threads/1-1）')
    expect(t.store.thread('session-1')).toMatchObject({ task: '改 README', worktree: { branch: 'dsh-threads/1-1' } })
    await run('--worktree 改 CHANGELOG')
    expect(t.store.thread('session-2')?.worktree?.branch).toBe('dsh-threads/2-2')
    // A word that only starts with -w is part of the task.
    await run('-wat 不是选项')
    expect(t.store.thread('session-3')).toMatchObject({ task: '-wat 不是选项', worktree: null })
  })

  it('shows the usage for an empty task', async () => {
    for (const input of ['', '   ', '-w', '--worktree  ']) {
      const result = await run(input)
      expect(result.kind).toBe('error')
      expect(result.text).toContain('用法：/thread <任务>')
    }
    expect(t.store.threadsOf('main')).toEqual([])
  })

  it('works only in a project\'s main conversation', async () => {
    expect(await run('任务', 'plain')).toEqual({ kind: 'error', text: expect.stringContaining('只有项目的主对话能开讨论串') })
    expect((await run('cleanup', 'plain')).kind).toBe('error')
  })

  it('passes refusals through as errors', async () => {
    t = setup({ maxRunning: 1 })
    run = command(t.manager)
    await run('第一件')
    expect(await run('第二件')).toEqual({ kind: 'error', text: expect.stringContaining('已有 1 个讨论串在运行（上限 1）') })
  })

  it('lists worktrees on cleanup and removes them only on cleanup confirm', async () => {
    expect((await run('cleanup')).text).toContain('没有可以清理的 worktree')
    await run('-w 改 README')
    // A running thread's worktree is never offered.
    expect((await run('cleanup')).text).toContain('没有可以清理的 worktree')
    await t.manager.onIdle('session-1')

    const listed = await run('cleanup')
    expect(listed.text).toContain('#1「改 README」dsh-threads/1-1')
    expect(listed.text).toContain('/thread cleanup confirm')
    expect(t.store.thread('session-1')?.worktree?.removed).toBe(false)

    const removed = await run('cleanup confirm')
    expect(removed).toEqual({ kind: 'success', text: '#1：已删除 worktree，分支 dsh-threads/1-1 已合并，一并删除。' })
    expect(t.store.thread('session-1')?.worktree?.removed).toBe(true)
  })
})
