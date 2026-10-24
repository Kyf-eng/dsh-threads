import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import pkg from '../package.json' with { type: 'json' }
import { apiHandlers } from './api.ts'
import { registerThreadCommand } from './command.ts'
import { Config } from './config.ts'
import './dsh-types.ts'
import { createHost } from './host.ts'
import { installPerAgent } from './install.ts'
import { ThreadManager } from './manager.ts'
import { Projects } from './projects.ts'
import { textOf } from './report.ts'
import { type ConnectionLike, registerRpc } from './rpc.ts'
import { optional } from './services.ts'
import './source.ts'
import { openStore } from './storage.ts'

export const name = 'dsh-threads'
export const inject = ['tools', 'agents', 'commands', 'sessionController', 'storageDomain', 'workspaceRegistry']
export { Config }

export async function apply(ctx: Context, config: Config): Promise<void> {
  const warn = (message: string) => ctx.logger.warn(message)
  const now = () => new Date().toISOString()
  const store = await openStore(ctx.storageDomain)
  const host = createHost(ctx)
  const manager = new ThreadManager({
    store,
    host,
    config,
    now,
    // Same shape DSH mints itself (dsh-api-session-controller: `session-${randomUUID()}`).
    newSessionId: () => `session-${randomUUID()}`,
    newProposalId: () => `proposal-${randomUUID()}`,
    warn,
  })
  const projects = new Projects({
    store,
    host,
    isThread: (sessionId) => manager.isThread(sessionId),
    now,
    newProjectId: () => `project-${randomUUID()}`,
  })
  const fail = (error: unknown) => warn(`dsh-threads: ${String(error)}`)

  ctx.on('agent/status', ({ agent, status }) => {
    if (status === 'idle') manager.onIdle(agent.id).catch(fail)
  })
  ctx.on('agent/inbox/inserted', ({ agent, message }) => {
    const text = textOf(message.content as { type: string; text?: string }[] | undefined) ?? ''
    manager.onInbox(agent.id, message.source.kind, Number(agent.session.seq), text).catch(fail)
  })

  installPerAgent(ctx, manager, projects, config)
  registerThreadCommand(ctx, manager, pkg.name)
  // Settle threads that were running when DSH last stopped.
  manager.recover().catch(fail)

  // `connection` is optional (headless profiles have none) and may be provided after this
  // plugin applies, so register once it is available instead of reading it here.
  ctx.inject(['connection'], (scoped) => {
    const connection = optional<ConnectionLike>(scoped, 'connection')
    if (connection === undefined) return
    scoped.effect(() => registerRpc(connection, apiHandlers({
      projects,
      manager,
      threadsOf: (mainSessionId) => store.threadsOf(mainSessionId),
      thread: (id) => store.thread(id),
      threads: () => store.threads(),
      plugin: { name: pkg.name, version: pkg.version },
      modelCatalog: () => ctx.sessionController.modelCatalog(),
      lastReply: (sessionId) => host.lastReply(sessionId),
    })) as () => void, 'dsh-threads: /api/dsh-threads')
  })
}
