// Per-session tools and instructions (pattern from dsh-experimental-tool-agent-team):
// ordinary sessions get the dispatcher tools, thread sessions get thread_report.
// Registrations made through agent.ctx belong to that agent's scope, so this module
// disposes them itself when the agent goes away or the plugin unloads.
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Config } from './config.ts'
import type { ThreadManager } from './manager.ts'
import { dispatcherPrompt, SECTION_ORDER, threadPrompt } from './prompts.ts'
import { threadOpenTool } from './tools/thread-open.ts'
import { threadReportTool } from './tools/thread-report.ts'
import { threadStatusTool } from './tools/thread-status.ts'

const SECTION_NAME = 'dsh-threads'

export function installPerAgent(ctx: Context, manager: ThreadManager, config: Config): void {
  const installed = new Map<Agent, () => void>()

  const install = (agent: Agent) => {
    if (installed.has(agent)) return
    // Subagent and Agent Team children are not conversations the user dispatches from.
    if (agent.session.header.origin === 'subagent') return
    const scope = agent.ctx
    const disposers: (() => void)[] = []
    try {
      if (manager.isThread(agent.id)) {
        disposers.push(scope.tools.register(threadReportTool(manager, config.summaryMaxChars)))
        disposers.push(scope.systemPrompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text: threadPrompt(config.summaryMaxChars) }))
      } else {
        disposers.push(scope.tools.register(threadOpenTool(ctx, manager)))
        disposers.push(scope.tools.register(threadStatusTool(manager)))
        disposers.push(scope.systemPrompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text: dispatcherPrompt(config.maxRunning) }))
      }
    } catch (error) {
      for (const dispose of disposers) dispose()
      ctx.logger.warn(`dsh-threads: could not install into session ${agent.id}: ${String(error)}`)
      return
    }
    installed.set(agent, () => { for (const dispose of disposers) dispose() })
  }

  const uninstall = (agent: Agent) => {
    installed.get(agent)?.()
    installed.delete(agent)
  }

  for (const agent of ctx.agents.list()) install(agent)
  ctx.on('agent/created', ({ agent }) => {
    install(agent)
    return undefined
  })
  ctx.on('agent/disposed', ({ agent }) => uninstall(agent))
  ctx.effect(() => () => {
    for (const dispose of installed.values()) dispose()
    installed.clear()
  }, 'dsh-threads: per-session tools')
}
