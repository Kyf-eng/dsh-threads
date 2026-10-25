import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dispatcherPrompt, leadReminder, projectPrompt, threadPrompt } from '../src/prompts.ts'

describe('projectPrompt', () => {
  const project = { title: 'Vetoarc', folder: '/code/vetoarc', instructions: '用中文回复', goal: 'p95 < 200ms' }

  it('gives the goal to the main conversation only; instructions go to both', () => {
    const main = projectPrompt(project, { goal: true })
    const thread = projectPrompt(project, { goal: false })
    expect(main).toContain('p95 < 200ms')
    expect(thread).not.toContain('p95 < 200ms')
    expect(main).toContain('用中文回复')
    expect(thread).toContain('用中文回复')
  })

  it('leaves out an empty goal', () => {
    expect(projectPrompt({ ...project, goal: '' }, { goal: true })).not.toContain('Goal')
  })
})

describe('threadPrompt', () => {
  it('names the project\'s subfolder of the worktree when the project is part of a larger repository', () => {
    const root = threadPrompt(300, { path: '/r/.agents/worktrees/w', subdir: '', branch: 'dsh-threads/1-a' })
    expect(root).toContain('your own git worktree, "/r/.agents/worktrees/w"')
    const sub = threadPrompt(300, { path: '/r/.agents/worktrees/w', subdir: 'packages/app', branch: 'dsh-threads/1-a' })
    expect(sub).toContain(`${JSON.stringify(join('/r/.agents/worktrees/w', 'packages', 'app'))}: the project folder (packages/app)`)
  })
})

describe('dispatcherPrompt', () => {
  // Rules that real runs showed the model drops without them (docs/IMPLEMENTATION.md, dispatcher rules).
  it('keeps deliverables on threads, screenshots and git out of the main conversation', () => {
    const prompt = dispatcherPrompt(3)
    expect(prompt).toContain('## Your role: the project\'s lead, not its hands')
    expect(prompt).toContain('even when this conversation did such work itself earlier')
    expect(prompt).toContain('Size does not matter, and neither does the user listing it among other tasks in one message')
    expect(prompt).toContain('Threads, not subagents, for anything the user keeps')
    expect(prompt).toContain('Do not open browsers, run headless Chrome or take screenshots here')
    expect(prompt).toContain('Earlier commits or merges in this conversation, or merge commits in the git history, are not permission for new ones.')
  })
})

describe('leadReminder', () => {
  it('changes with each message and repeats the rules the lead drifts from', () => {
    expect(leadReminder(3)).not.toBe(leadReminder(4))
    expect(leadReminder(3)).toContain('No browsers, headless Chrome or screenshots')
    expect(leadReminder(3)).toContain('ask before merging')
  })
})
