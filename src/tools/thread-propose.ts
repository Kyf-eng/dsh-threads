import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { type ThreadManager, ThreadError } from '../manager.ts'

export function threadProposeTool(manager: ThreadManager, maxPerCall: number): ToolDefinition {
  return defineTool({
    name: 'thread_propose',
    description: 'Suggest threads the user did not ask for (follow-up work you noticed). They appear as a checklist card above the input; '
      + 'nothing starts until the user picks them. Use thread_open instead when the user asked for the work.',
    parameters: {
      items: {
        type: 'array',
        required: true,
        description: `1 to ${maxPerCall} suggestions, most valuable first.`,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string', required: true, description: 'Short title, at most 30 characters.' },
            task: {
              type: 'string',
              required: true,
              description: 'Complete, self-contained brief, as for thread_open; the user may start it much later.',
            },
          },
        },
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('thread_propose needs a calling session')
      try {
        const proposals = await manager.propose(caller.id, args.items)
        return `已把 ${proposals.length} 个提议放进输入框上方的卡片：${proposals.map((p) => `「${p.title}」`).join('、')}。`
          + '用户勾选后才会开讨论串；不要等待，也不要在回复里重复列出。'
      } catch (error) {
        if (error instanceof ThreadError) return `没有提议：${error.message}`
        throw error
      }
    },
  })
}
