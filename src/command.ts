import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands/brand'
import { type ThreadManager, ThreadError, titleFrom } from './manager.ts'
import { msg } from './messages.ts'

/**
 * `/thread <task>`: the manual entry point, for when the model does not open a thread itself.
 * `-w` gives the thread its own worktree; `stop <n>` stops thread #n; `cleanup` lists finished
 * worktrees and `cleanup confirm` removes them (the confirmation step the plan asks for).
 */
export function registerThreadCommand(ctx: Context, manager: ThreadManager, packageName: string): void {
  ctx.commands.register({
    definitionId: CommandDefinitionId(packageName),
    name: 'thread',
    // Registered once, before any browser says which language it uses: both languages.
    description: 'Open a thread / 开一个讨论串: /thread [-w] <task>; /thread stop <n>; /thread cleanup',
    input: { hint: '[-w] <task> | stop <n> | cleanup' },
    handler: async ({ agent, rawInput }) => {
      const m = msg()
      const input = rawInput.trim()
      if (!manager.isDispatcher(agent.id)) return { kind: 'error', text: m.notAProject }
      if (input === 'cleanup' || input === 'cleanup confirm') return cleanup(manager, agent.id, input === 'cleanup confirm')
      const stop = /^stop\s+#?(\d+)$/.exec(input)
      if (stop !== null) {
        try {
          const thread = await manager.stopNumber(agent.id, Number(stop[1]))
          return { kind: 'success', text: m.commandStopped(thread.n, thread.title) }
        } catch (error) {
          return { kind: 'error', text: error instanceof ThreadError ? error.message : m.stopFailed(String(error)) }
        }
      }
      const worktree = /^(-w|--worktree)(\s|$)/.test(input)
      const task = worktree ? input.replace(/^(-w|--worktree)/, '').trim() : input
      if (task.length === 0) return { kind: 'error', text: `${m.usage}${m.usageTask}` }
      try {
        const thread = await manager.open(agent.id, { title: titleFrom(task), task, initiation: 'user_asked', worktree })
        return { kind: 'success', text: m.commandOpened(thread.n, thread.title, thread.worktree?.branch ?? null) }
      } catch (error) {
        return { kind: 'error', text: error instanceof ThreadError ? error.message : m.openFailed(String(error)) }
      }
    },
  })
}

async function cleanup(manager: ThreadManager, mainSessionId: string, confirmed: boolean): Promise<{ kind: 'success' | 'error'; text: string }> {
  const m = msg()
  const candidates = manager.cleanupCandidates(mainSessionId)
  if (candidates.length === 0) return { kind: 'success', text: m.cleanupNone }
  if (!confirmed) {
    return { kind: 'success', text: m.cleanupList(candidates.map((t) => m.cleanupItem(t.n, t.title, t.worktree?.branch ?? ''))) }
  }
  const lines = await manager.cleanupWorktrees(mainSessionId)
  return { kind: 'success', text: lines.join('\n') }
}
