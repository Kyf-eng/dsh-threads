import { describe, expect, it } from 'vitest'
import { glyphState } from '../../src/client/glyphs.tsx'
import { groupThreads, type ThreadView } from '../../src/client/threads.ts'

const report = (status: 'done' | 'needs_decision', summary = '') => ({ status, summary, changedFiles: [], decisions: [], at: '' })
const thread = (n: number, patch: Partial<ThreadView> = {}): ThreadView => ({
  id: `session-${n}`, mainSessionId: 'main', n, title: `t${n}`, status: 'idle', resolved: false, archived: false,
  initiation: 'user_asked', lastReport: report('done'), error: null, worktree: null, createdAt: '', updatedAt: `2026-10-24T0${n}:00:00Z`, ...patch,
})

describe('groupThreads', () => {
  const threads = [
    thread(1),
    thread(2, { lastReport: report('needs_decision', 'pick a skin') }),
    thread(3, { status: 'running' }),
    thread(4, { resolved: true }),
    thread(5, { archived: true, lastReport: report('needs_decision') }),
    thread(6, { title: 'Sound doc' }),
    thread(7),
  ]
  const live = new Set(['session-7'])
  const ids = (list: ThreadView[]) => list.map((t) => t.n)

  it('puts each thread in Claude\'s sections, newest first', () => {
    const groups = groupThreads(threads, (t) => glyphState(t, live.has(t.id)))
    expect(ids(groups.waiting)).toEqual([2])
    // Session 7 is running live although its record still says idle.
    expect(ids(groups.running)).toEqual([7, 3])
    expect(ids(groups.idle)).toEqual([6, 1])
    expect(ids(groups.resolved)).toEqual([4])
    // An archived thread never waits on the user.
    expect(ids(groups.archived)).toEqual([5])
  })

  it('filters by number, title or summary', () => {
    const state = (t: ThreadView) => glyphState(t)
    expect(ids(groupThreads(threads, state, 'sound').idle)).toEqual([6])
    expect(ids(groupThreads(threads, state, '#2').waiting)).toEqual([2])
    expect(ids(groupThreads(threads, state, 'SKIN').waiting)).toEqual([2])
    expect(Object.values(groupThreads(threads, state, 'nothing')).flat()).toEqual([])
  })
})
