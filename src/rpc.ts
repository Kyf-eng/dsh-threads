/**
 * Browser ↔ host calls for the panel (src/client).
 *
 * One exact Fetch route under the shared `/api` channel. `connection.rpc.handle` is not
 * usable from a third-party plugin: it registers through the caller's `ctx.webServer`,
 * which is not visible to profile bundles on Desktop. `connection.fetch.register` is
 * dispatched by the Connection plugin itself and admits only the owner principal.
 */
export const RPC_PATH = '/api/dsh-threads'

export type RpcHandlers = Record<string, (payload: unknown) => unknown>

interface FetchRoute {
  path: string
  methods: string[]
  requestBody: 'buffered' | 'streaming'
  fetch(request: Request): Promise<Response>
}

export interface ConnectionLike {
  fetch: { register(route: FetchRoute): unknown }
}

/** Body the client sends: `{ method, payload }`. */
interface RpcRequest {
  method?: unknown
  payload?: unknown
}

export async function dispatchRpc(handlers: RpcHandlers, request: Request): Promise<Response> {
  let body: RpcRequest
  try {
    body = await request.json() as RpcRequest
  } catch {
    return Response.json({ error: 'body is not JSON' }, { status: 400 })
  }
  const handler = typeof body.method === 'string' ? handlers[body.method] : undefined
  if (handler === undefined) return Response.json({ error: `unknown method ${JSON.stringify(body.method)}` }, { status: 404 })
  try {
    return Response.json({ result: await handler(body.payload) })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}

export function registerRpc(connection: ConnectionLike, handlers: RpcHandlers): unknown {
  return connection.fetch.register({
    path: RPC_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: (request) => dispatchRpc(handlers, request),
  })
}
