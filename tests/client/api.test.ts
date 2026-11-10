import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Api = typeof import('../../src/client/api.ts')

/** One pending `fetch`: the test settles it when it wants the host to "answer". */
interface Call {
  method: string
  answer: (result: unknown) => void
  fail: (error: string) => void
}

const project = (id: string) => ({ id, title: id })

describe('refreshProjects', () => {
  let api: Api
  let calls: Call[]

  beforeEach(async () => {
    calls = []
    vi.stubGlobal('fetch', (_url: string, init: { body: string }) => new Promise((resolve) => {
      const { method } = JSON.parse(init.body) as { method: string }
      calls.push({
        method,
        answer: (result) => resolve({ ok: true, status: 200, json: async () => ({ result }) }),
        fail: (error) => resolve({ ok: false, status: 500, json: async () => ({ error }) }),
      })
    }))
    // The store is module state: every test starts from an untouched one.
    vi.resetModules()
    api = await import('../../src/client/api.ts')
  })

  afterEach(() => { vi.unstubAllGlobals() })

  const titles = () => api.projectsStore.getSnapshot().projects.map((p) => p.id)

  it('asks again after a list that was already in flight, instead of publishing that stale one', async () => {
    // A list request from before the mutation is still out...
    const before = api.projectsStore.refresh()
    expect(calls).toHaveLength(1)
    // ...when a create finishes and wants the list reloaded.
    const reloaded = api.refreshProjects()
    await Promise.resolve()
    expect(calls).toHaveLength(1)

    calls[0]!.answer([project('a')])
    await before
    await vi.waitFor(() => expect(calls).toHaveLength(2))
    calls[1]!.answer([project('a'), project('b')])
    await reloaded

    expect(titles()).toEqual(['a', 'b'])
    expect(api.projectsStore.getSnapshot().status).toBe('ready')
  })

  it('plain refresh() shares the in-flight request, which is why mutations must not use it', async () => {
    const first = api.projectsStore.refresh()
    const second = api.projectsStore.refresh()
    expect(calls).toHaveLength(1)
    calls[0]!.answer([project('a')])
    await Promise.all([first, second])
    expect(calls).toHaveLength(1)
    expect(titles()).toEqual(['a'])
  })

  it('still reloads when the stale request fails', async () => {
    void api.projectsStore.refresh()
    const reloaded = api.refreshProjects()
    calls[0]!.fail('boom')
    await vi.waitFor(() => expect(calls).toHaveLength(2))
    expect(api.projectsStore.getSnapshot().status).toBe('error')
    calls[1]!.answer([project('a')])
    await reloaded

    expect(titles()).toEqual(['a'])
    expect(api.projectsStore.getSnapshot()).toMatchObject({ status: 'ready', error: null })
  })

  it('is one request when nothing is in flight', async () => {
    const reloaded = api.refreshProjects()
    await vi.waitFor(() => expect(calls).toHaveLength(1))
    calls[0]!.answer([project('a')])
    await reloaded
    expect(calls).toHaveLength(1)
    expect(calls[0]!.method).toBe('projects.list')
  })
})
