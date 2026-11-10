// Which answer may still close a dialog that saves before it closes (ProjectSettings.tsx).

/**
 * A dialog that saves its pending fields on close has two ways to go wrong: the save traps it
 * (it fails, or never answers), or a save that is no longer the latest word closes it later and
 * takes newer edits with it. The gate settles both:
 *
 * - every request to close is its own attempt, with its own id, and only the attempt that is
 *   still waiting may act on its save's answer;
 * - asking to close again while an attempt waits (its save is still out, or was refused) leaves
 *   at once;
 * - an edit, a reopening or a completed close forgets the waiting attempt, so its answer, whenever
 *   it comes, decides nothing.
 */
export interface CloseGate {
  /** A close was asked for: `'leave'` to close now, otherwise the id of the attempt to save for. */
  request(): number | 'leave'
  /** Whether this attempt is still the one waiting, i.e. whether its save's answer still counts. */
  current(attempt: number): boolean
  /** Forget the waiting attempt (the user edited, the dialog reopened, or the close went through). */
  reset(): void
}

export function createCloseGate(): CloseGate {
  let attempts = 0
  let waiting: number | null = null
  return {
    request() {
      if (waiting !== null) {
        waiting = null
        return 'leave'
      }
      attempts += 1
      waiting = attempts
      return attempts
    },
    current: (attempt) => waiting === attempt,
    reset() { waiting = null },
  }
}
