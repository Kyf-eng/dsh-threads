import type { Context } from '@deepseek-ai/cordis'
import pkg from '../package.json' with { type: 'json' }
import { Config } from './config.ts'
import { optional } from './probe.ts'
import { type ConnectionLike, registerRpc } from './rpc.ts'
import './source.ts'
import { createProbeState } from './state.ts'
import { registerThreadStatusTool } from './tools/thread-status.ts'

export const name = 'dsh-threads'
export const inject = ['tools']
export { Config }

const RECENT_CREATED = 5

export function apply(ctx: Context, _config: Config): void {
  const state = createProbeState({ name: pkg.name, version: pkg.version })

  ctx.on('agent/created', ({ agent, source }) => {
    state.agentCreated += 1
    state.recentCreated = [{ id: agent.id, source }, ...state.recentCreated].slice(0, RECENT_CREATED)
    return undefined
  })
  ctx.on('agent/status', ({ agent, status }) => {
    if (state.probeSessions.has(agent.id)) state.probeSessions.set(agent.id, status)
  })

  registerThreadStatusTool(ctx, state)
  // `connection` is optional (headless profiles have none) and may be provided after this
  // plugin applies, so register once it is available instead of reading it here.
  ctx.inject(['connection'], (scoped) => {
    const connection = optional<ConnectionLike>(scoped, 'connection')
    if (connection === undefined) return
    try {
      scoped.effect(() => registerRpc(connection, {
        ping: () => {
          state.rpcPings += 1
          return { ok: true, plugin: state.plugin, loadedAt: state.loadedAt, pings: state.rpcPings }
        },
      }) as () => void, 'dsh-threads: /api/dsh-threads')
      state.rpcRegistered = true
    } catch (error) {
      state.rpcError = String(error)
    }
  })
}
