import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { type ThreadManager, ThreadError } from '../manager.ts'
import { truncate } from '../report.ts'
import { optional } from '../services.ts'

const OFFER_ID = 'dsh-threads-offer'
const OPEN = '开讨论串'
const HERE = '在主对话里做'
const SKIP = '先不做'

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
      if (args.initiation === 'offer') {
        const questions = optional<UserQuestionsLike>(ctx, 'userQuestions')
        if (questions === undefined) return { text: '没法在界面上询问用户（userQuestions 不可用）。请在回复里直接问用户要不要开讨论串。' }
        const answer = await questions.ask({
          questions: [{
            id: OFFER_ID,
            header: '讨论串',
            question: `要为「${truncate(args.title, 30)}」开一个讨论串吗？`,
            detail: truncate(args.task, 600),
            options: [
              { label: OPEN, description: '在后台的新会话里做，做完把摘要发回这里' },
              { label: HERE, description: '就在当前对话里做' },
              { label: SKIP, description: '先不做' },
            ],
          }],
          agent: caller,
          signal: exec.signal,
          wait: { callId: exec.callId },
        })
        const item = answer.answers.find((entry) => entry.id === OFFER_ID)
        const choice = item?.selected[0]
        if (choice === HERE) return { text: '用户选择在主对话里做：不要开讨论串，直接在这里做这件事。' }
        if (choice === SKIP) return { text: '用户选择先不做这件事：不要开讨论串，也不要开始做。' }
        if (choice !== OPEN) return { text: `用户没有选择开讨论串，回答是：${item?.custom ?? '（无）'}。按用户的回答处理，不要开讨论串。` }
      }
      try {
        const thread = await manager.open(caller.id, { title: args.title, task: args.task, initiation: args.initiation, worktree: args.worktree === true })
        const where = thread.worktree === null ? '' : `它在自己的 worktree 里工作（分支 ${thread.worktree.branch}，从 ${thread.worktree.baseCommit.slice(0, 7)} 开出）。`
        return {
          text: `已开讨论串 #${thread.n}「${thread.title}」（会话 ${thread.id}），它在后台运行，用户可以在侧栏点开它。${where}`
            + '它做完会把摘要发回这里；不要等待或轮询，继续做别的事或结束本轮。',
          threadId: thread.id,
          n: thread.n,
          title: thread.title,
        }
      } catch (error) {
        if (error instanceof ThreadError) return { text: `没有开讨论串：${error.message}` }
        throw error
      }
    },
  })
}
