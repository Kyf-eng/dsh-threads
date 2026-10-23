import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import pkg from '../package.json' with { type: 'json' }
import { registerThreadCommand } from './command.ts'
import { Config } from './config.ts'
import './dsh-types.ts'
import { createHost } from './host.ts'
import { installPerAgent } from './install.ts'
import { ThreadManager } from './manager.ts'
import { type ConnectionLike, registerRpc } from './rpc.ts'
import { optional } from './services.ts'
import './source.ts'
import { openStore } from './storage.ts'

export const name = 'dsh-threads'
export const inject = ['tools', 'agents', 'commands', 'sessionController', 'storageDomain', 'workspaceRegistry']
export { Config }

export async function apply(ctx: Context, config: Config): Promise<void> {
  const warn = (message: string) => ctx.logger.warn(message)
  const store = await openStore(ctx.storageDomain)
  const manager = new ThreadManager({
    store,
    host: createHost(ctx),
    config,
    now: () => new Date().toISOString(),
    // Same shape DSH mints itself (dsh-api-session-controller: `session-${randomUUID()}`).
    newSessionId: () => `session-${randomUUID()}`,
    warn,
  })
  const fail = (error: unknown) => warn(`dsh-threads: ${String(error)}`)

  ctx.on('agent/status', ({ agent, status }) => {
    if (status === 'idle') manager.onIdle(agent.id).catch(fail)
  })
  ctx.on('agent/inbox/inserted', ({ agent, message }) => {
    manager.onInbox(agent.id, message.source.kind, Number(agent.session.seq)).catch(fail)
  })

  installPerAgent(ctx, manager, config)
  registerThreadCommand(ctx, manager, pkg.name)

  // `connection` is optional (headless profiles have none) and may be provided after this
  // plugin applies, so register once it is available instead of reading it here.
  ctx.inject(['connection'], (scoped) => {
    const connection = optional<ConnectionLike>(scoped, 'connection')
    if (connection === undefined) return
    scoped.effect(() => registerRpc(connection, {
      ping: () => ({ ok: true, plugin: { name: pkg.name, version: pkg.version } }),
    }) as () => void, 'dsh-threads: /api/dsh-threads')
  })
}
