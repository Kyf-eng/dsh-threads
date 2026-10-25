import { afterEach, describe, expect, it } from 'vitest'
import { COMMAND_NODE, openedNumber, opensThread, threadCommandDefinition } from '../../src/client/chat.ts'
import { msg, setLanguage } from '../../src/messages.ts'

afterEach(() => setLanguage('zh'))

describe('opensThread', () => {
  it('tells a task from the stop and cleanup subcommands', () => {
    expect(opensThread(' -w 在 docs 下新建 a.md')).toBe(true)
    expect(opensThread('stopwatch the build')).toBe(true)
    expect(opensThread(' stop 3')).toBe(false)
    expect(opensThread('cleanup confirm')).toBe(false)
    expect(opensThread('  ')).toBe(false)
    expect(opensThread(undefined)).toBe(false)
  })
})

describe('openedNumber', () => {
  it('reads the thread number from /thread\'s reply in either language', () => {
    expect(openedNumber(msg().commandOpened(7, '写文档', 'dsh-threads/7-abc'))).toBe(7)
    setLanguage('en')
    expect(openedNumber(msg().commandOpened(12, 'Write docs', null))).toBe(12)
    expect(openedNumber(msg().cleanupNone)).toBeNull()
  })
})

describe('threadCommandDefinition', () => {
  const run = (args: string) => ({ event: { type: 'command/run', seq: 10, time: 1, data: { commandId: 'c1', name: 'thread', args } } })
  const done = (kind: string, text: string) => ({ event: { type: 'command/done', seq: 11, time: 2, data: { commandId: 'c1', kind, text } } })
  const node = (args: string, kind: string, text: string) => {
    const location = { kind: 'turn' }
    const started = threadCommandDefinition.start({ key: 'k', id: 'c1', state: undefined }, run(args))
    const state = threadCommandDefinition.update({ key: 'k', id: 'c1', state: started }, done(kind, text))
    return threadCommandDefinition.buildViewNode({ key: 'k', id: 'c1', state, start: { location } })
  }

  it('only claims /thread runs, and any done (which names no command)', () => {
    expect(threadCommandDefinition.match(run('x').event)).toEqual({ id: 'c1', role: 'start' })
    expect(threadCommandDefinition.match({ type: 'command/run', seq: 1, time: 0, data: { commandId: 'c2', name: 'model', args: '' } })).toBeNull()
    expect(threadCommandDefinition.match(done('success', '').event)).toEqual({ id: 'c1', role: 'update' })
  })

  // A conversation of command rows alone stays on DSH's welcome page; this node is what moves it.
  it('puts the opened thread right after the command row', () => {
    expect(node('-w 写文档', 'success', msg().commandOpened(3, '写文档', 'dsh-threads/3-abc'))).toMatchObject({
      kind: COMMAND_NODE, target: 'chat', anchorSeq: 11, location: { kind: 'turn' }, data: { n: 3 },
    })
  })

  it('adds nothing for stop, cleanup or a refused open', () => {
    expect(node('stop 3', 'success', msg().commandStopped(3, '写文档'))).toBeNull()
    expect(node('cleanup', 'success', msg().cleanupNone)).toBeNull()
    expect(node('-w 写文档', 'error', msg().openFailed('#2 正在运行'))).toBeNull()
  })
})
