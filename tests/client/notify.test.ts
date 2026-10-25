import { describe, expect, it } from 'vitest'
import { wantsNotification } from '../../src/client/notify.ts'

describe('wantsNotification', () => {
  it('follows Claude-style levels', () => {
    const cases = [
      ['all', 'main', false, true], ['all', 'thread', false, true], ['all', 'thread', true, true],
      ['attention', 'main', false, true], ['attention', 'thread', false, false], ['attention', 'thread', true, true],
      ['waiting', 'main', false, false], ['waiting', 'main', true, true], ['waiting', 'thread', false, false], ['waiting', 'thread', true, true],
      ['none', 'main', false, false], ['none', 'thread', true, false],
    ] as const
    for (const [level, kind, waiting, expected] of cases) expect(wantsNotification(level, kind, waiting)).toBe(expected)
  })
})
