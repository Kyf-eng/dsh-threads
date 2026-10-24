import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { type ThreadManager, ThreadError } from '../manager.ts'
import { inEveryLanguage, msg } from '../messages.ts'
import { truncate } from '../report.ts'
import { optional } from '../services.ts'

const OFFER_ID = 'dsh-threads-offer'

interface UserQuestionsLike {
  ask(request: {
    questions: {
      id: string
      question: string
      header?: string
      detail?: string
      options?: { label: string; description?: string }[]
    }[]
    agent?: unknown
    signal?: AbortSignal
    wait?: { callId: unknown }
  }): Promise<{ answers: { id: string; selected: string[]; custom?: string }[] }>
}

const DESCRIPTION = 'Open a thread: a real background session for a self-contained task. It reports back here with a short summary when it finishes. '
  + 'In this project, use it instead of a subagent for work that writes files or takes more than a few minutes, so this conversation stays free. '
  + 'See the "Threads (dsh-threads)" section of your instructions for when to use it and which initiation to pass.'

export function threadOpenTool(ctx: Context, manager: ThreadManager): ToolDefinition {
  return defineTool({
    name: 'thread_open',
    description: DESCRIPTION,
    parameters: {
      title: { type: 'string', required: true, description: 'Short title for the sidebar, at most 30 characters.' },
      task: {
        type: 'string',
        required: true,
        description: 'Complete, self-contained brief: goal, relevant files or context, constraints, and what done looks like. The thread cannot see this conversation.',
      },
      initiation: {
        type: 'string',
        required: true,
        enum: ['user_asked', 'offer'],
        description: '"user_asked" when the user explicitly asked for a thread or separate/background work; "offer" when the user named the task but did not ask for a thread (the user is asked first).',
      },
      worktree: {
        type: 'boolean',
        description: 'true when the thread will change files in a git repository: it gets its own worktree and branch. Leave false for read-only work.',
      },
    },
    output: {
      // threadId/n/title reach the browser as `presentationMeta` (the turn's thread card).
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
          threadId: { type: 'string' },
          n: { type: 'integer' },
          title: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (_args, value) => (value.threadId === undefined
        ? null
        : { threadId: value.threadId, n: value.n ?? 0, title: value.title ?? '' }),
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('thread_open needs a calling session')
      const m = msg()
      if (args.initiation === 'offer') {
        const questions = optional<UserQuestionsLike>(ctx, 'userQuestions')
        if (questions === undefined) return { text: m.offerUnavailable }
        const answer = await questions.ask({
          questions: [{
            id: OFFER_ID,
            header: m.offerHeader,
            question: m.offerQuestion(truncate(args.title, 30)),
            detail: truncate(args.task, 600),
            options: [
              { label: m.offerOpen, description: m.offerOpenDetail },
              { label: m.offerHere, description: m.offerHereDetail },
              { label: m.offerSkip, description: m.offerSkipDetail },
            ],
          }],
          agent: caller,
          signal: exec.signal,
          wait: { callId: exec.callId },
        })
        const item = answer.answers.find((entry) => entry.id === OFFER_ID)
        const choice = item?.selected[0] ?? ''
        // The browser may switch language while the question waits: accept either wording.
        if (inEveryLanguage('offerHere').includes(choice)) return { text: msg().offerChoseHere }
        if (inEveryLanguage('offerSkip').includes(choice)) return { text: msg().offerChoseSkip }
        if (!inEveryLanguage('offerOpen').includes(choice)) return { text: msg().offerChoseOther(item?.custom) }
      }
      try {
        const thread = await manager.open(caller.id, { title: args.title, task: args.task, initiation: args.initiation, worktree: args.worktree === true })
        const where = thread.worktree === null ? '' : msg().toolOpenedWorktree(thread.worktree.branch, thread.worktree.baseCommit.slice(0, 7))
        return {
          text: msg().toolOpened(thread.n, thread.title, thread.id, where),
          threadId: thread.id,
          n: thread.n,
          title: thread.title,
        }
      } catch (error) {
        if (error instanceof ThreadError) return { text: msg().toolNotOpened(error.message) }
        throw error
      }
    },
  })
}
