import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { type ThreadManager, ThreadError } from '../manager.ts'
import { msg } from '../messages.ts'

export function threadReplyTool(manager: ThreadManager): ToolDefinition {
  return defineTool({
    name: 'thread_reply',
    description: 'Send more instructions to an existing thread of this conversation (by its number #n) instead of opening a new one. '
      + 'An idle thread starts working on it right away; a busy thread takes it next. Its report comes back here as usual.',
    parameters: {
      n: { type: 'integer', required: true, description: 'Thread number (#n), as shown by thread_status.' },
      message: {
        type: 'string',
        required: true,
        description: 'The instruction, self-contained: what to do next and what done looks like.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('thread_reply needs a calling session')
      try {
        const thread = await manager.reply(caller.id, args.n, args.message)
        return msg().toolReplied(thread.n, thread.title)
      } catch (error) {
        if (error instanceof ThreadError) return msg().toolNotSent(error.message)
        throw error
      }
    },
  })
}
