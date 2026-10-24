import { describe, expect, it } from 'vitest'
import { sidebarCss } from '../../src/client/kinds.ts'

describe('sidebarCss', () => {
  it('hides thread rows and adds ↳N to main conversation rows that have threads', () => {
    const css = sidebarCss({
      threads: new Set(['session-a', 'session-b']),
      mains: new Map([['session-m', { icon: 'folder', threads: 2, running: 1, waiting: 0 }], ['session-empty', { icon: 'folder', threads: 0, running: 0, waiting: 0 }]]),
    })
    expect(css).toContain('[data-row-key="session:session-a"],[data-row-key="session:session-b"]{display:none!important}')
    expect(css).toContain('[data-row-key="session:session-m"]>span:nth-child(3)::before{content:"↳ 2"')
    expect(css).not.toContain('session-empty')
  })

  it('writes nothing when there are no threads', () => {
    expect(sidebarCss({ threads: new Set(), mains: new Map() })).toBe('')
  })
})
