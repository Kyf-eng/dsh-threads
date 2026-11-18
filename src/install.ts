// Per-session tools and instructions (pattern from dsh-experimental-tool-agent-team).
// A project's main conversation gets the dispatcher tools, a thread gets thread_report,
// both get the project's context; every other session gets nothing. Roles change when
// projects are created or removed, so live sessions are re-evaluated on every change.
// Registrations made through agent.ctx belong to that agent's scope, so this module
// disposes them itself when the agent goes away or the plugin unloads.
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Config } from './config.ts'
import type { ThreadManager } from './manager.ts'
import { mountedFolders, type Projects } from './projects.ts'
import { dispatcherPrompt, LEAD_CONTEXT_ORDER, leadReminder, projectPrompt, SECTION_ORDER, STOPPED_CONTEXT_ORDER, stoppedReminder, threadPrompt } from './prompts.ts'
import { type Role, roleOf } from './roles.ts'
import { optional } from './services.ts'
import { threadOpenTool } from './tools/thread-open.ts'
import { threadProposeTool } from './tools/thread-propose.ts'
import { threadReplyTool } from './tools/thread-reply.ts'
import { threadReportTool } from './tools/thread-report.ts'
import { threadStatusTool } from './tools/thread-status.ts'

/** DSH's per-session extra writable roots (sandboxPolicy); the browser half never sees it. */
interface SandboxPolicyLike {
  /** Let this exact session write under the directory from now on; the disposer takes the grant back. */
  registerWritableRoot(session: Agent['session'], directory: string): () => void
}

const SECTION_NAME = 'dsh-threads'
const PROJECT_SECTION_NAME = 'dsh-threads-project'
const LEAD_CONTEXT_NAME = 'dsh-threads-lead'
const STOPPED_CONTEXT_NAME = 'dsh-threads-stopped'

export function installPerAgent(ctx: Context, manager: ThreadManager, projects: Projects, config: Config): void {
  const installed = new Map<Agent, { role: Role; folders: string; dispose: () => void }>()

  const install = (agent: Agent) => {
    const folders = mountedFolders(projects.ofSession(agent.id))
    const folderKey = folders.join('\n')
    const role = roleOf({ id: agent.id, origin: agent.session.header.origin }, manager)
    const current = installed.get(agent)
    // A changed mount list reinstalls too: the sandbox grants are per session and per install.
    if (current?.role === role && current.folders === folderKey) return
    current?.dispose()
    installed.delete(agent)
    if (role === 'none') {
      installed.set(agent, { role, folders: folderKey, dispose: () => {} })
      return
    }
    const scope = agent.ctx
    const disposers: (() => void)[] = []
    try {
      disposers.push(scope.systemPrompt.section({
        name: PROJECT_SECTION_NAME,
        order: SECTION_ORDER - 1,
        text: () => projectPrompt(projects.ofSession(agent.id), { goal: role === 'dispatcher' }),
      }))
      // DSH resolves one workspace root per session plus the extra writable roots registered for
      // it; file tools and sandboxed commands read that one policy, so a mounted folder is usable
      // in workspace-write mode instead of being refused.
      const policy = optional<SandboxPolicyLike>(scope, 'sandboxPolicy')
      if (policy !== undefined) {
        for (const folder of folders) disposers.push(policy.registerWritableRoot(agent.session, folder))
      }
      if (role === 'thread') {
        disposers.push(scope.tools.register(threadReportTool(manager, config.summaryMaxChars)))
        disposers.push(scope.systemPrompt.section({
          name: SECTION_NAME,
          order: SECTION_ORDER,
          text: () => threadPrompt(config.summaryMaxChars, manager.worktreeOf(agent.id)),
        }))
        // Empty (no snapshot) unless the user stopped the thread; then it rides with whatever DSH wakes it for.
        disposers.push(scope.systemPrompt.context({ name: STOPPED_CONTEXT_NAME, order: STOPPED_CONTEXT_ORDER, text: () => (manager.isStopped(agent.id) ? stoppedReminder() : '') }))
      } else {
        disposers.push(scope.tools.register(threadOpenTool(ctx, manager, config.offerApproval)))
        disposers.push(scope.tools.register(threadProposeTool(manager, config.maxProposalsPerTurn)))
        disposers.push(scope.tools.register(threadReplyTool(manager)))
        disposers.push(scope.tools.register(threadStatusTool(manager)))
        disposers.push(scope.systemPrompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text: dispatcherPrompt(config.maxRunning, config.offerApproval) }))
        disposers.push(scope.systemPrompt.context({ name: LEAD_CONTEXT_NAME, order: LEAD_CONTEXT_ORDER, text: () => leadReminder(manager.inboxCount(agent.id)) }))
      }
    } catch (error) {
      for (const dispose of disposers) dispose()
      ctx.logger.warn(`dsh-threads: could not install into session ${agent.id}: ${String(error)}`)
      return
    }
    installed.set(agent, { role, folders: folderKey, dispose: () => { for (const dispose of disposers) dispose() } })
  }

  const uninstall = (agent: Agent) => {
    installed.get(agent)?.dispose()
    installed.delete(agent)
  }

  const refresh = () => { for (const agent of ctx.agents.list()) install(agent) }

  refresh()
  ctx.on('agent/created', ({ agent }) => {
    install(agent)
    return undefined
  })
  ctx.on('agent/disposed', ({ agent }) => uninstall(agent))
  ctx.effect(() => projects.onChange(refresh), 'dsh-threads: project roles')
  ctx.effect(() => () => {
    for (const entry of installed.values()) entry.dispose()
    installed.clear()
  }, 'dsh-threads: per-session tools')
}
