import { describe, expect, it } from 'vitest'
import { notifyTarget } from '../src/api.ts'
import type { ThreadRecord } from '../src/types.ts'

const project = { title: 'Vetoarc', notify: 'attention' as const, archived: false }

function thread(report: ThreadRecord['lastReport']): ThreadRecord {
  return {
    id: 'session-t', mainSessionId: 'session-m', n: 3, title: '查依赖', task: 'x', initiation: 'user_asked', status: 'idle',
    resolved: false, round: null, userMessages: [], roundStartSeq: null, roundStartedAt: null, lastReport: report, error: null,
    worktree: null, reminder: null, createdAt: '', updatedAt: '',
  }
}

describe('notifyTarget', () => {
  const deps = (t: ThreadRecord | undefined) => ({
    thread: (id: string) => (id === t?.id ? t : undefined),
    projectOfMain: (main: string) => (main === 'session-m' ? project : undefined),
    lastReply: () => '## 好了，**已合并**',
  })

  it('describes a main conversation with its last reply as plain text', () => {
    expect(notifyTarget('session-m', deps(undefined))).toMatchObject({ kind: 'main', projectTitle: 'Vetoarc', level: 'attention', text: '好了，已合并' })
  })

  it('describes a waiting thread by the decision it asks for', () => {
    const waiting = thread({ status: 'needs_decision', summary: '有两个方案', changedFiles: [], decisions: ['用方案 A 吗？'], at: '' })
    expect(notifyTarget('session-t', deps(waiting))).toMatchObject({ kind: 'thread', waiting: true, n: 3, text: '用方案 A 吗？', status: 'needs_decision' })
    const done = thread({ status: 'done', summary: '升级完了', changedFiles: [], decisions: [], at: '' })
    expect(notifyTarget('session-t', deps(done))).toMatchObject({ waiting: false, text: '升级完了' })
  })

  it('ignores sessions outside projects and archived projects', () => {
    expect(notifyTarget('session-x', deps(undefined))).toBeNull()
    expect(notifyTarget('session-m', { ...deps(undefined), projectOfMain: () => ({ ...project, archived: true }) })).toBeNull()
  })
})
