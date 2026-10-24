import { describe, expect, it } from 'vitest'
import { projectPrompt } from '../src/prompts.ts'

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
