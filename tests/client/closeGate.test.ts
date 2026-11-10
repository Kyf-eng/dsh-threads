import { describe, expect, it } from 'vitest'
import { createCloseGate } from '../../src/client/closeGate.ts'

describe('createCloseGate', () => {
  it('lets the waiting attempt close, once', () => {
    const gate = createCloseGate()
    const attempt = gate.request()
    expect(attempt).not.toBe('leave')
    expect(gate.current(attempt as number)).toBe(true)
    gate.reset()
    expect(gate.current(attempt as number)).toBe(false)
  })

  it('leaves at once when asked again while a save is out or was refused', () => {
    const gate = createCloseGate()
    const first = gate.request() as number
    expect(gate.request()).toBe('leave')
    // The save that was out answers after the dialog has gone: it decides nothing.
    expect(gate.current(first)).toBe(false)
    // And the next close starts a fresh attempt instead of leaving.
    expect(gate.request()).not.toBe('leave')
  })

  it('gives every attempt its own id, so an earlier save cannot close on behalf of a later one', () => {
    const gate = createCloseGate()
    // Close: the first save goes out and stays out.
    const first = gate.request() as number
    // The user keeps editing, then closes again: a second save goes out.
    gate.reset()
    const second = gate.request() as number
    expect(second).not.toBe(first)
    // The second save fails: its attempt is the one waiting, so the dialog stays with the error.
    expect(gate.current(second)).toBe(true)
    // The first save then succeeds. It must not close the dialog over the newer, unsaved edit.
    expect(gate.current(first)).toBe(false)
    // The refused attempt is still waiting, so closing once more leaves.
    expect(gate.request()).toBe('leave')
  })

  it('forgets a waiting attempt when the dialog is opened again', () => {
    const gate = createCloseGate()
    const before = gate.request() as number
    gate.reset()
    const after = gate.request() as number
    expect(gate.current(before)).toBe(false)
    expect(gate.current(after)).toBe(true)
  })
})
