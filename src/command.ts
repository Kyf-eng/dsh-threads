import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands/brand'
import { type ThreadManager, ThreadError, titleFrom } from './manager.ts'

/** `/thread <task>`: the manual entry point, for when the model does not open a thread itself. */
export function registerThreadCommand(ctx: Context, manager: ThreadManager, packageName: string): void {
  ctx.commands.register({
    definitionId: CommandDefinitionId(packageName),
    name: 'thread',
    description: '开一个讨论串：/thread <任务>',
    input: { hint: '<任务>' },
    handler: async ({ agent, rawInput }) => {
      const task = rawInput.trim()
      if (task.length === 0) return { kind: 'error', text: '用法：/thread <任务>。任务要写清目标、相关文件和完成标准。' }
      try {
        const thread = await manager.open(agent.id, { title: titleFrom(task), task, initiation: 'user_asked' })
        return { kind: 'success', text: `已开讨论串 #${thread.n}「${thread.title}」，做完会把摘要发回这里。` }
      } catch (error) {
        return { kind: 'error', text: error instanceof ThreadError ? error.message : `开讨论串失败：${String(error)}` }
      }
    },
  })
}
