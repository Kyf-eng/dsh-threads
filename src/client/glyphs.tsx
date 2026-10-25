// Thread state marks, after Claude's: a breathing dot while a thread works, a raised hand
// when it waits on the user, a hollow ring once it is done. Every surface (sidebar, cards,
// lists, pane header) uses these so a state looks the same everywhere.
import type { SVGProps } from 'react'
import type { ThreadView } from './threads.ts'

export type GlyphState = 'running' | 'waiting' | 'done' | 'failed' | 'resolved' | 'queued'

/** The one place thread data turns into a state mark. */
export function glyphState(thread: Pick<ThreadView, 'status' | 'resolved' | 'lastReport'> & { archived?: boolean }, running = false, asking = false): GlyphState {
  // An approval, a question or a plan held for the user: the turn is still open but waits on them.
  if (asking) return 'waiting'
  if (running || thread.status === 'running' || thread.status === 'starting') return 'running'
  if (thread.status === 'failed') return 'failed'
  if (thread.resolved) return 'resolved'
  // Put away by the user: it no longer waits on them.
  if (thread.archived === true) return 'done'
  return reportGlyph(thread.lastReport?.status)
}

/** For card data that carries only the report status (`done`, `needs_decision`, `no-report`, …). */
export function reportGlyph(status: string | undefined): GlyphState {
  if (status === 'needs_decision' || status === 'blocked') return 'waiting'
  if (status === 'failed') return 'failed'
  return 'done'
}

function Svg({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

/** Raised hand (path from Lucide, ISC). */
export function HandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83L7 15" />
    </Svg>
  )
}

export function ThreadGlyph({ state, label }: { state: GlyphState; label?: string }) {
  const common = { className: `dsht-glyph dsht-glyph-${state}`, title: label, role: label === undefined ? undefined : 'img', 'aria-label': label }
  switch (state) {
    case 'running':
      return <span {...common}><span className="dsht-pulse" /></span>
    case 'waiting':
      return <span {...common}><HandIcon /></span>
    case 'failed':
      return <span {...common}><Svg><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6M15 9l-6 6" /></Svg></span>
    case 'resolved':
      return <span {...common}><Svg><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-4.9" /></Svg></span>
    case 'queued':
      return <span {...common}><Svg><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg></span>
    case 'done':
      return <span {...common}><Svg><circle cx="12" cy="12" r="6.5" /></Svg></span>
  }
}
