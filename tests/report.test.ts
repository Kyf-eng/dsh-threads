import { describe, expect, it } from 'vitest'
import { composeNote, currentReport, normalizeReport, plainLine, textOf, truncate } from '../src/report.ts'
import type { ThreadRecord } from '../src/types.ts'

const thread = { id: 'session-1', n: 2, title: '整理依赖' }

describe('truncate', () => {
  it('leaves short text alone and marks a cut', () => {
    expect(truncate('abc', 3)).toBe('abc')
    expect(truncate('abcdef', 4)).toBe('abc…')
  })

  it('counts code points, not UTF-16 units', () => {
    expect(truncate('讨论串🧵很长', 4)).toBe('讨论串…')
  })
})

describe('plainLine', () => {
  it('drops markdown markers and joins lines', () => {
    expect(plainLine('## 统计结果：共有 **7 个 JSON 文件**\n\n- `run_live/a.json`\n> 只读')).toBe('统计结果：共有 7 个 JSON 文件 run_live/a.json 只读')
  })
})

describe('composeNote', () => {
  const report = normalizeReport({ status: 'done', summary: '依赖已更新，测试通过。', changedFiles: ['package.json'], decisions: ['要不要升级到 v5'] }, 300, '2026-10-23T10:00:00.000Z')

  it('carries status, summary, changed files and decisions', () => {
    const note = composeNote(thread, report, undefined, 400)
    expect(note).toContain('#2「整理依赖」· done')
    expect(note).toContain('摘要：依赖已更新，测试通过。')
    expect(note).toContain('改动：package.json')
    expect(note).toContain('待用户决定：要不要升级到 v5')
    expect(note).toContain('不是证据')
  })

  it('never exceeds the limit', () => {
    const long = normalizeReport({ status: 'done', summary: '很长'.repeat(500) }, 2000, report.at)
    expect([...composeNote(thread, long, undefined, 400)].length).toBeLessThanOrEqual(400)
  })

  it('falls back to the last reply when the thread did not report', () => {
    const note = composeNote(thread, null, '我把三个文件都改好了。', 400)
    expect(note).toContain('no-report')
    expect(note).toContain('没有调用 thread_report')
    expect(note).toContain('我把三个文件都改好了。')
  })

  it('says so when there is neither a report nor a reply', () => {
    expect(composeNote(thread, null, undefined, 400)).toContain('没有回报也没有回复')
  })
})

describe('currentReport', () => {
  const base: ThreadRecord = {
    id: 'session-1', mainSessionId: 'main', n: 1, title: 't', task: 'x', initiation: 'user_asked',
    status: 'running', resolved: false, round: 'dispatch', roundStartSeq: 0, roundStartedAt: '2026-10-23T10:00:00.000Z',
    lastReport: null, error: null, worktree: null, reminder: null, createdAt: '', updatedAt: '',
  }
  const report = (at: string) => normalizeReport({ status: 'done', summary: 's' }, 300, at)

  it('accepts a report made during this round', () => {
    expect(currentReport({ ...base, lastReport: report('2026-10-23T10:05:00.000Z') })).not.toBeNull()
  })

  it('ignores a report left over from an earlier round', () => {
    expect(currentReport({ ...base, lastReport: report('2026-10-23T09:00:00.000Z') })).toBeNull()
  })
})

describe('normalizeReport', () => {
  it('bounds the summary and drops empty list items', () => {
    const report = normalizeReport({ status: 'blocked', summary: `  ${'x'.repeat(50)}  `, changedFiles: [' a.ts ', ''], decisions: [] }, 10, 'now')
    expect([...report.summary].length).toBe(10)
    expect(report.changedFiles).toEqual(['a.ts'])
  })
})

describe('textOf', () => {
  it('joins text blocks and ignores others', () => {
    expect(textOf([{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }])).toBe('a\nb')
    expect(textOf([{ type: 'image' }])).toBeUndefined()
  })
})
