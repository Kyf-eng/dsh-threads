import { describe, expect, it } from 'vitest'
import { projectOnlyWorkspaces, sidebarCss, sidebarProjects } from '../../src/client/kinds.ts'

const main = { icon: 'folder', threads: 2, running: 1, waiting: 0, threadIds: ['session-a'] }

describe('sidebarCss', () => {
  it('hides thread and main conversation rows, and project-only workspaces with their "show more" row', () => {
    const css = sidebarCss({
      threads: new Set(['session-a']),
      mains: new Map([['session-m', main]]),
      hiddenWorkspaces: new Set(['ws-1']),
    })
    expect(css).toBe([
      '[data-row-key="session:session-a"]',
      '[data-row-key="session:session-m"]',
      '[data-row-key="workspace:ws-1"]',
      '[data-row-key="overflow:ws-1"]',
    ].join(',') + '{display:none!important}')
  })

  it('writes nothing when there are no projects', () => {
    expect(sidebarCss({ threads: new Set(), mains: new Map(), hiddenWorkspaces: new Set() })).toBe('')
  })
})

describe('sidebarProjects', () => {
  const project = (id: string, lastActivity: string, extra: { pinned?: boolean; archived?: boolean } = {}) =>
    ({ id, lastActivity, pinned: extra.pinned ?? false, archived: extra.archived ?? false })

  it('leaves out archived projects and puts pinned ones first, then the latest activity', () => {
    const rows = sidebarProjects([
      project('old', '2026-10-01T00:00:00Z'),
      project('archived', '2026-10-24T00:00:00Z', { archived: true }),
      project('new', '2026-10-20T00:00:00Z'),
      project('pinned', '2026-09-01T00:00:00Z', { pinned: true }),
    ])
    expect(rows.map((row) => row.id)).toEqual(['pinned', 'new', 'old'])
  })
})

describe('projectOnlyWorkspaces', () => {
  const sessions = {
    'session-main': {},
    'session-thread': {},
    'session-blank': { blank: true },
    'session-other': {},
    'session-archived': {},
    'session-sub': { origin: 'subagent' },
  }
  const project = new Set(['session-main', 'session-thread'])
  const workspace = (workspaceId: string, sessionIds: string[]) => ({ workspaceId, sessionIds })

  it('drops a workspace whose only sessions DSH would show are project sessions', () => {
    const hidden = projectOnlyWorkspaces([
      workspace('ws-project', ['session-main', 'session-thread', 'session-blank', 'session-archived', 'session-sub', 'session-unknown']),
      workspace('ws-mixed', ['session-main', 'session-other']),
      workspace('ws-plain', ['session-other']),
      workspace('ws-empty', []),
    ], sessions, new Set(['session-archived']), project, undefined)
    expect(hidden).toEqual(['ws-project'])
  })

  it('keeps it while its blank session is the one open', () => {
    expect(projectOnlyWorkspaces([workspace('ws', ['session-main', 'session-blank'])], sessions, new Set(), project, 'session-blank')).toEqual([])
  })
})
