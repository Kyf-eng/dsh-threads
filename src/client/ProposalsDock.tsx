// conversation.input.dock entry above the composer: threads the main conversation proposed
// (thread_propose), as a checklist with "开始 N 个讨论串" (Claude's suggestion card).
import { Button, Checkbox } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import { callHost } from './api.ts'
import { ThreadsIcon } from './icons.tsx'
import type { Translate } from './locale.ts'
import { type ProposalView, threadsRevision, useHostValue, useThreadsRevision } from './threads.ts'

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
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  if (sessionId === undefined || proposals === undefined || proposals.length === 0) return null

  const pending = proposals.filter((p) => p.state === 'pending')
  const queued = proposals.filter((p) => p.state === 'queued')
  const chosen = pending.filter((p) => !unchecked.has(p.id)).map((p) => p.id)
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
    <div className="dsht-proposals">
      <div className="dsht-chat-card-head"><ThreadsIcon size={14} />{t('proposals.title')}</div>
      {pending.map((proposal) => (
        <div key={proposal.id} className="dsht-proposal">
          <Checkbox
            checked={!unchecked.has(proposal.id)}
            label={proposal.title}
            onChange={(next) => {
              const set = new Set(unchecked)
              if (next) set.delete(proposal.id)
              else set.add(proposal.id)
              setUnchecked(set)
            }}
          />
          <span className="dsht-row-summary">{proposal.task}</span>
        </div>
      ))}
      {queued.map((proposal) => (
        <div key={proposal.id} className="dsht-proposal dsht-proposal-queued">
          <span className="dsht-row-title">{proposal.title}</span>
          <span className="dsht-row-meta">{t('proposals.queued')}</span>
        </div>
      ))}
      <div className="dsht-buttons">
        {pending.length > 0 ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => { void act('proposals.dismiss', pending.map((p) => p.id)) }}>
            {t('proposals.dismiss')}
          </Button>
        ) : null}
        {pending.length > 0 ? (
          <Button variant="primary" size="sm" disabled={busy || chosen.length === 0} onClick={() => { void act('proposals.start', chosen) }}>
            {t('proposals.start', { count: chosen.length })}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
