// The plugin's small design kit, after Claude's thread UI: a thread item (state mark, title,
// summary, the decision it waits on, changed files, branch), chips and pill buttons. Every
// surface (transcript cards, proposals, the thread list, the pane header) is built from these,
// so a thread looks the same wherever it appears. Styling lives in styles.ts (`.dsht-*`).
import type { ReactNode, SVGProps } from 'react'
import { type GlyphState, ThreadGlyph } from './glyphs.tsx'

function Svg({ children, size = 14, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

export function ChevronIcon() {
  return <Svg><path d="m9.5 6 6 6-6 6" /></Svg>
}

/** "↳": replies under a message, as in Claude's "↰ 2 条回复". */
export function RepliesIcon() {
  return <Svg><path d="M6 4.5v7a3 3 0 0 0 3 3h9.5M15 11l3.5 3.5L15 18" /></Svg>
}

export function BranchIcon() {
  return (
    <Svg>
      <circle cx="6.5" cy="5.5" r="2" /><circle cx="6.5" cy="18.5" r="2" /><circle cx="17.5" cy="7.5" r="2" />
      <path d="M6.5 7.5v9M17.5 9.5c0 4-5 3.5-9.6 7.4" />
    </Svg>
  )
}

export function StartIcon() {
  return <Svg><path d="M9 7 4.5 11.5 9 16" /><path d="M4.5 11.5h10a5 5 0 0 0 5-5V5" /></Svg>
}

export function CheckIcon() {
  return <Svg><path d="m5.5 12.5 4 4 9-9.5" /></Svg>
}

export function ReopenIcon() {
  return <Svg><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" /><path d="M4.5 4.5V9H9" /></Svg>
}

export function ExpandIcon() {
  return <Svg><path d="M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5 13 11M4.5 19.5 11 13" /></Svg>
}

export function StopIcon() {
  return <Svg><rect x="6.5" y="6.5" width="11" height="11" rx="2" /></Svg>
}

/** Archive box (paths from Lucide, ISC). */
export function ArchiveIcon() {
  return <Svg><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" /></Svg>
}

export function CloseIcon() {
  return <Svg><path d="m7 7 10 10M17 7 7 17" /></Svg>
}

type FileKind = 'doc' | 'code' | 'data' | 'other'

const KINDS: Record<string, FileKind> = {
  md: 'doc', mdx: 'doc', txt: 'doc', rst: 'doc', doc: 'doc', docx: 'doc', pdf: 'doc',
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code', mjs: 'code', cjs: 'code', py: 'code', go: 'code', rs: 'code',
  java: 'code', kt: 'code', swift: 'code', c: 'code', h: 'code', cpp: 'code', cs: 'code', rb: 'code', php: 'code',
  css: 'code', scss: 'code', html: 'code', vue: 'code', svelte: 'code', sh: 'code', sql: 'code',
  json: 'data', yml: 'data', yaml: 'data', toml: 'data', csv: 'data', xml: 'data', lock: 'data', env: 'data',
}

export function fileKind(path: string): FileKind {
  const name = path.split(/[\\/]/).pop() ?? path
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? 'other' : KINDS[name.slice(dot + 1).toLowerCase()] ?? 'other'
}

function FileIcon({ kind }: { kind: FileKind }) {
  if (kind === 'code') return <Svg><path d="m9 8-4 4 4 4M15 8l4 4-4 4" /></Svg>
  if (kind === 'data') return <Svg><path d="M9 4.5c-2 0-2.5 1-2.5 2.5v2.5c0 1.2-.8 2.5-2 2.5 1.2 0 2 1.3 2 2.5V17c0 1.5.5 2.5 2.5 2.5M15 4.5c2 0 2.5 1 2.5 2.5v2.5c0 1.2.8 2.5 2 2.5-1.2 0-2 1.3-2 2.5V17c0 1.5-.5 2.5-2.5 2.5" /></Svg>
  return (
    <Svg>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" /><path d="M14 3.5V8h4.5" />
      {kind === 'doc' ? <path d="M8.5 12.5h7M8.5 15.5h5" /> : null}
    </Svg>
  )
}

/** A changed file, with Claude's colored type icon (documents green, code blue, data amber). */
export function FileChip({ path }: { path: string }) {
  const kind = fileKind(path)
  const name = path.split(/[\\/]/).pop() ?? path
  return (
    <span className={`dsht-chip dsht-file dsht-file-${kind}`} title={path}>
      <FileIcon kind={kind} /><span className="dsht-chip-text">{name}</span>
    </span>
  )
}

export function BranchChip({ branch, removed }: { branch: string; removed?: boolean }) {
  return (
    <span className={`dsht-chip dsht-branch${removed === true ? ' dsht-branch-removed' : ''}`} title={branch}>
      <BranchIcon /><span className="dsht-chip-text dsht-mono">{branch}</span>
    </span>
  )
}

export function Pill({ children, onClick, primary, disabled, icon, label }: {
  children?: ReactNode
  onClick: () => void
  primary?: boolean
  disabled?: boolean
  icon?: ReactNode
  /** Accessible name for an icon-only pill. */
  label?: string
}) {
  return (
    <button type="button" className={`dsht-pill${primary === true ? ' dsht-pill-primary' : ''}${children === undefined ? ' dsht-pill-icon' : ''}`}
      disabled={disabled} aria-label={label} title={label}
      onClick={(event) => { event.stopPropagation(); onClick() }}>
      {icon}{children}
    </button>
  )
}

/** Small label above a group of items ("建议的讨论串", "↳ 2 条回复"). */
export function CardHead({ icon, children, trailing }: { icon?: ReactNode; children: ReactNode; trailing?: ReactNode }) {
  return <div className="dsht-head-label">{icon}<span>{children}</span>{trailing === undefined ? null : <span className="dsht-head-trailing">{trailing}</span>}</div>
}

export interface ThreadItemProps {
  n: number
  title: string
  state: GlyphState
  /** Short status word after the title ("已完成", "运行中"). */
  status?: string
  summary?: string
  /** The question the thread waits on; shown with the raised hand. */
  decision?: string
  decisionLabel?: string
  files?: readonly string[]
  branch?: string
  stateLabel?: string
  openLabel: string
  onOpen: () => void
  /** One line: mark, title, status and chips, as Claude's inline thread cards. */
  compact?: boolean
}

/**
 * One thread, as Claude draws it in a conversation: the whole item opens the thread; a thread
 * waiting on the user also shows an explicit "查看讨论串" pill.
 */
export function ThreadItem(props: ThreadItemProps) {
  const { n, title, state, status, summary, decision, decisionLabel, files, branch, stateLabel, openLabel, onOpen, compact } = props
  const waiting = state === 'waiting'
  return (
    <div className={`dsht-item dsht-item-${state}${compact === true ? ' dsht-item-compact' : ''}`} role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}>
      <ThreadGlyph state={state} label={stateLabel} />
      <div className="dsht-item-body">
        <div className="dsht-item-title">
          <span className="dsht-item-n">#{n}</span>
          <span className="dsht-item-name">{title}</span>
          {status === undefined ? null : <span className="dsht-item-status">{status}</span>}
        </div>
        {compact === true || decision === undefined || decision.length === 0 ? null : (
          <div className="dsht-item-decision">{decisionLabel === undefined ? null : <b>{decisionLabel}</b>}{decision}</div>
        )}
        {compact === true || summary === undefined || summary.length === 0 ? null : <div className="dsht-item-summary">{summary}</div>}
        {(files?.length ?? 0) === 0 && branch === undefined ? null : (
          <div className="dsht-chips">
            {branch === undefined ? null : <BranchChip branch={branch} />}
            {files?.map((file) => <FileChip key={file} path={file} />)}
          </div>
        )}
      </div>
      {waiting
        ? <Pill onClick={onOpen}>{openLabel}</Pill>
        : <span className="dsht-item-chevron" aria-hidden="true"><ChevronIcon /></span>}
    </div>
  )
}
