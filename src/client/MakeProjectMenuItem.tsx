import { MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useState } from 'react'
import { callHost, refreshProjects } from './api.ts'
import { ProjectsIcon } from './icons.tsx'
import { threadsRevision } from './threads.ts'
import type { Translate } from './locale.ts'

/** "设为项目" in a session's "…" menu; hidden for threads and sessions that already are projects. */
export function MakeProjectMenuItem({ sessionId, displayTitle, useMenuOpenState, t, showProjects }: {
  sessionId: string
  displayTitle: string
  useMenuOpenState: () => [boolean, (open: boolean) => void]
  t: Translate
  showProjects: () => void
}) {
  const [, setMenuOpen] = useMenuOpenState()
  const [eligible, setEligible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    callHost<{ project: unknown; thread: boolean }>('sessions.role', { id: sessionId }).then(
      (role) => { if (live) setEligible(role.project === null && !role.thread) },
      () => { if (live) setEligible(false) },
    )
    return () => { live = false }
  }, [sessionId])

  if (!eligible) return null
  // The host refuses real cases (the session is not in a workspace, a blank title), and with the
  // menu closed that refusal would vanish. So the menu stays open until the host has answered:
  // it closes on success, and shows the refusal above the item otherwise. Reopening it afterwards
  // instead would pop a menu up over whatever the user had moved on to.
  const run = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    callHost('projects.create', { title: displayTitle, fromSessionId: sessionId })
      .then(() => { threadsRevision.bump(); return refreshProjects() })
      .then(() => { setMenuOpen(false); showProjects() })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)))
      .finally(() => setBusy(false))
  }
  return (
    <>
      {error === null ? null : <div className="dsht-error dsht-menu-message" role="alert">{error}</div>}
      <MenuItemButton icon={<ProjectsIcon size={16} />} disabled={busy} onSelect={run}>
        {t('menu.makeProject')}
      </MenuItemButton>
    </>
  )
}
