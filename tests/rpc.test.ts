import { describe, expect, it } from 'vitest'
import { dispatchRpc, RPC_PATH } from '../src/rpc.ts'

const post = (body: string) => new Request(`http://127.0.0.1${RPC_PATH}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
})

describe('dispatchRpc', () => {
  const handlers = {
    ping: () => ({ ok: true }),
    echo: (payload: unknown) => payload,
    boom: () => { throw new Error('nope') },
  }

  it('returns the handler result under `result`', async () => {
    const response = await dispatchRpc(handlers, post(JSON.stringify({ method: 'echo', payload: { n: 1 } })))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ result: { n: 1 } })
  })

  it('rejects a body that is not JSON', async () => {
    expect((await dispatchRpc(handlers, post('not json'))).status).toBe(400)
  })

  it('returns 404 for an unknown method', async () => {
    expect((await dispatchRpc(handlers, post(JSON.stringify({ method: 'nope' })))).status).toBe(404)
  })

  it('returns 500 with the error text when a handler throws', async () => {
    const response = await dispatchRpc(handlers, post(JSON.stringify({ method: 'boom' })))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Error: nope' })
  })
})
