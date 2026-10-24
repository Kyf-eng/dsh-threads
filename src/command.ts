import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands/brand'
import { NOT_A_PROJECT, type ThreadManager, ThreadError, titleFrom } from './manager.ts'

const USAGE = '用法：/thread <任务>；/thread -w <任务> 在独立 worktree 里做；/thread stop <n> 停止讨论串 #n；/thread cleanup 清理做完的 worktree。'

/**
 * `/thread <task>`: the manual entry point, for when the model does not open a thread itself.
 * `-w` gives the thread its own worktree; `stop <n>` stops thread #n; `cleanup` lists finished
 * worktrees and `cleanup confirm` removes them (the confirmation step the plan asks for).
 */
export function registerThreadCommand(ctx: Context, manager: ThreadManager, packageName: string): void {
  ctx.commands.register({
    definitionId: CommandDefinitionId(packageName),
    name: 'thread',
    description: '开一个讨论串：/thread [-w] <任务>；/thread stop <n>；/thread cleanup',
    input: { hint: '[-w] <任务> | stop <n> | cleanup' },
    handler: async ({ agent, rawInput }) => {
      const input = rawInput.trim()
      if (!manager.isDispatcher(agent.id)) return { kind: 'error', text: NOT_A_PROJECT }
      if (input === 'cleanup' || input === 'cleanup confirm') return cleanup(manager, agent.id, input === 'cleanup confirm')
      const stop = /^stop\s+#?(\d+)$/.exec(input)
      if (stop !== null) {
        try {
          const thread = await manager.stopNumber(agent.id, Number(stop[1]))
          return { kind: 'success', text: `已停止讨论串 #${thread.n}「${thread.title}」。` }
        } catch (error) {
          return { kind: 'error', text: error instanceof ThreadError ? error.message : `停止失败：${String(error)}` }
        }
      }
      const worktree = /^(-w|--worktree)(\s|$)/.test(input)
      const task = worktree ? input.replace(/^(-w|--worktree)/, '').trim() : input
      if (task.length === 0) return { kind: 'error', text: `${USAGE}任务要写清目标、相关文件和完成标准。` }
      try {
        const thread = await manager.open(agent.id, { title: titleFrom(task), task, initiation: 'user_asked', worktree })
        const branch = thread.worktree === null ? '' : `（分支 ${thread.worktree.branch}）`
        return { kind: 'success', text: `已开讨论串 #${thread.n}「${thread.title}」${branch}，做完会把摘要发回这里。` }
      } catch (error) {
        return { kind: 'error', text: error instanceof ThreadError ? error.message : `开讨论串失败：${String(error)}` }
      }
    },
  })
}

async function cleanup(manager: ThreadManager, mainSessionId: string, confirmed: boolean): Promise<{ kind: 'success' | 'error'; text: string }> {
  const candidates = manager.cleanupCandidates(mainSessionId)
  if (candidates.length === 0) return { kind: 'success', text: '没有可以清理的 worktree（运行中的讨论串不算）。' }
  if (!confirmed) {
    const list = candidates.map((t) => `#${t.n}「${t.title}」${t.worktree?.branch ?? ''}`).join('；')
    return {
      kind: 'success',
      text: `会删除这些讨论串的 worktree：${list}。有没提交改动的会跳过；分支只在已合并时删除。确认请输入 /thread cleanup confirm。`,
    }
  }
  const lines = await manager.cleanupWorktrees(mainSessionId)
  return { kind: 'success', text: lines.join('\n') }
}
