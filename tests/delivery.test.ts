import { describe, expect, it } from 'vitest'
import { decideDelivery, flushNotes, type MainAgent } from '../src/delivery.ts'
import type { MainRecord } from '../src/types.ts'

function agent(status: 'idle' | 'running' = 'idle') {
  const sent = { followup: [] as string[], inject: [] as string[] }
  const main: MainAgent = {
    status,
    followup: (text) => { sent.followup.push(text) },
    inject: (text) => { sent.inject.push(text) },
  }
  return { main, sent }
}

const record = (notes: MainRecord['pendingNotes'], autoWakeStreak = 0): MainRecord => ({ id: 'main', autoWakeStreak, pendingNotes: notes })
const loud = (text: string) => ({ threadId: 't', text, quiet: false })
const quiet = (text: string) => ({ threadId: 't', text, quiet: true })

describe('decideDelivery', () => {
  const base = { mainStatus: 'idle' as const, runningThreads: 0, autoWakeStreak: 0, maxAutoWakes: 5 }

  it('wakes an idle main conversation with no running threads', () => {
    expect(decideDelivery(base)).toBe('wake')
  })

  it('holds while the main conversation is running', () => {
    expect(decideDelivery({ ...base, mainStatus: 'running' })).toBe('hold')
  })

  it('holds while another thread of this main conversation is still running', () => {
    expect(decideDelivery({ ...base, runningThreads: 1 })).toBe('hold')
  })

  it('stops waking once the streak reaches the limit', () => {
    expect(decideDelivery({ ...base, autoWakeStreak: 5 })).toBe('quiet')
  })
})

describe('flushNotes', () => {
  it('wakes with all loud notes in one message and counts the wake-up', () => {
    const { main, sent } = agent()
    const result = flushNotes(record([loud('a'), loud('b')]), main, 0, 5)
    expect(sent.followup).toEqual(['a\n\nb'])
    expect(result.woke).toBe(true)
    expect(result.record.autoWakeStreak).toBe(1)
    expect(result.record.pendingNotes).toEqual([])
  })

  it('keeps loud notes pending while holding', () => {
    const { main, sent } = agent('running')
    const result = flushNotes(record([loud('a')]), main, 0, 5)
    expect(sent.followup).toEqual([])
    expect(result.record.pendingNotes).toEqual([loud('a')])
  })

  it('injects instead of waking at the wake-up limit (loop guard)', () => {
    const { main, sent } = agent()
    const result = flushNotes(record([loud('a')], 5), main, 0, 5)
    expect(sent.followup).toEqual([])
    expect(sent.inject).toEqual(['a'])
    expect(result.record.autoWakeStreak).toBe(5)
    expect(result.record.pendingNotes).toEqual([])
  })

  it('always injects quiet notes, even while holding loud ones', () => {
    const { main, sent } = agent('running')
    const result = flushNotes(record([quiet('q'), loud('a')]), main, 0, 5)
    expect(sent.inject).toEqual(['q'])
    expect(result.record.pendingNotes).toEqual([loud('a')])
  })
})
