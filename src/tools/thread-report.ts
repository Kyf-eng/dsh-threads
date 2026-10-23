import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { type ThreadManager, ThreadError } from '../manager.ts'

export function threadReportTool(manager: ThreadManager, summaryMaxChars: number): ToolDefinition {
  return defineTool({
    name: 'thread_report',
    description: 'REQUIRED before you finish every reply in this thread: report the round to the main conversation that opened it. '
      + 'Only this report reaches the main conversation; your reply text does not. Call it exactly once, right before your final words; '
      + 'calling it again replaces the earlier report.',
    parameters: {
      status: {
        type: 'string',
        required: true,
        enum: ['done', 'blocked', 'needs_decision', 'failed'],
        description: 'done: the task is complete. blocked: you cannot continue. needs_decision: the user must decide something (list it in decisions). failed: the task did not work.',
      },
      summary: {
        type: 'string',
        required: true,
        description: `At most ${summaryMaxChars} characters: what is now true, and what is not done or not verified.`,
      },
      changedFiles: { type: 'array', items: { type: 'string' }, description: 'Files you created or changed, relative to the workspace.' },
      decisions: { type: 'array', items: { type: 'string' }, description: 'Decisions the user must make, one per item.' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('thread_report needs a calling session')
      try {
        await manager.recordReport(caller.id, {
          status: args.status,
          summary: args.summary,
          changedFiles: args.changedFiles ?? [],
          decisions: args.decisions ?? [],
        })
        return '回报已记录，结束本轮时会发给主对话。现在用一两句话结束回复，不要再调用工具。'
      } catch (error) {
        if (error instanceof ThreadError) return error.message
        throw error
      }
    },
  })
}
