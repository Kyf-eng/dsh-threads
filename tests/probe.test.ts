import { describe, expect, it } from 'vitest'
import { optional, probeServices } from '../src/probe.ts'

describe('probeServices', () => {
  it('reports provided services and treats throwing lookups as missing', () => {
    const provided = new Map<string, unknown>([['tools', {}], ['sessions', {}]])
    const get = (name: string) => {
      if (name === 'connection') throw new Error('cannot get property "connection" without inject')
      return provided.get(name)
    }
    expect(probeServices(get, ['tools', 'sessions', 'connection', 'worktrees'])).toEqual({
      tools: true,
      sessions: true,
      connection: false,
      worktrees: false,
    })
  })
})

describe('optional', () => {
  it('returns undefined instead of throwing for a missing service', () => {
    const ctx = { get: (name: string) => { throw new Error(`missing ${name}`) } }
    expect(optional(ctx, 'sessionController')).toBeUndefined()
  })

  it('returns the service when the host provides it', () => {
    const service = { ok: true }
    expect(optional({ get: () => service }, 'sessionController')).toBe(service)
  })
})
