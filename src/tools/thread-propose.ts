import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { type ThreadManager, ThreadError } from '../manager.ts'
import { msg } from '../messages.ts'

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
            worktree: { type: 'boolean', description: 'As for thread_open: true when the thread will change files.' },
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
        return msg().toolProposed(proposals.map((p) => p.title))
      } catch (error) {
        if (error instanceof ThreadError) return msg().toolNotProposed(error.message)
        throw error
      }
    },
  })
}
