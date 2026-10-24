// conversation.input.dock entry above the composer: threads the main conversation proposed
// (thread_propose), as Claude's "建议的讨论串" card: start one with its own button, or all
// of them with "开始 N 个讨论串"; ones past the running limit wait in a queue.
import { useState } from 'react'
import { callHost } from './api.ts'
import { ThreadGlyph } from './glyphs.tsx'
import { ThreadsIcon } from './icons.tsx'
import type { Translate } from './locale.ts'
import { type ProposalView, threadsRevision, useHostValue, useThreadsRevision } from './threads.ts'
import { BranchIcon, CardHead, CloseIcon, Pill, StartIcon } from './ui.tsx'

type UseStatus = <T>(selector: (statuses: ReadonlyMap<string, { running?: boolean }>) => T) => T

export function ProposalsDock({ sessionId, useSessionStatus, t }: {
  sessionId: string | undefined
  useSessionStatus: UseStatus
  t: Translate
}) {
  const revision = useThreadsRevision()
  // Proposals arrive during the main conversation's turn; reload when any session starts or stops.
  const runningKey = useSessionStatus((statuses) =>
    [...statuses].filter(([, state]) => state.running === true).map(([id]) => id).sort().join(','))
  const proposals = useHostValue<ProposalView[]>(sessionId === undefined ? null : 'proposals.list', { mainSessionId: sessionId }, [sessionId, runningKey, revision])
  const [busy, setBusy] = useState(false)
  if (sessionId === undefined || proposals === undefined || proposals.length === 0) return null

  const pending = proposals.filter((p) => p.state === 'pending')
  const act = async (method: 'proposals.start' | 'proposals.dismiss', ids: string[]) => {
    setBusy(true)
    try {
      await callHost(method, { mainSessionId: sessionId, ids })
      threadsRevision.bump()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dsht-card dsht-proposals">
      <CardHead icon={<ThreadsIcon size={14} />}>{t('proposals.title')}</CardHead>
      <div className="dsht-proposal-list">
        {proposals.map((proposal) => (
          <div key={proposal.id} className={`dsht-proposal${proposal.state === 'queued' ? ' dsht-proposal-queued' : ''}`}>
            <div className="dsht-proposal-body">
              <div className="dsht-proposal-title">
                {proposal.title}
                {proposal.worktree ? <span className="dsht-tag" title={t('proposals.worktree')}><BranchIcon />{t('proposals.worktree')}</span> : null}
              </div>
              <div className="dsht-proposal-task">
                {proposal.state === 'queued' ? <><ThreadGlyph state="queued" />{t('proposals.queued')}</> : proposal.task.split('\n', 1)[0]}
              </div>
            </div>
            {proposal.state === 'pending' ? (
              <div className="dsht-proposal-actions">
                <Pill icon={<CloseIcon />} label={t('proposals.dismissOne')} disabled={busy} onClick={() => { void act('proposals.dismiss', [proposal.id]) }} />
                <Pill icon={<StartIcon />} label={t('proposals.startOne')} disabled={busy} onClick={() => { void act('proposals.start', [proposal.id]) }} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {pending.length === 0 ? null : (
        <div className="dsht-card-foot">
          <Pill disabled={busy} onClick={() => { void act('proposals.dismiss', pending.map((p) => p.id)) }}>{t('proposals.dismiss')}</Pill>
          <Pill primary disabled={busy} onClick={() => { void act('proposals.start', pending.map((p) => p.id)) }}>
            {t('proposals.start', { count: pending.length })}
          </Pill>
        </div>
      )}
    </div>
  )
}
