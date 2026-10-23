import { describe, expect, it } from 'vitest'
import { optional } from '../src/services.ts'

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
