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

  useEffect(() => {
    let live = true
    callHost<{ project: unknown; thread: boolean }>('sessions.role', { id: sessionId }).then(
      (role) => { if (live) setEligible(role.project === null && !role.thread) },
      () => { if (live) setEligible(false) },
    )
    return () => { live = false }
  }, [sessionId])

  if (!eligible) return null
  const run = () => {
    setError(null)
    setMenuOpen(false)
    callHost('projects.create', { title: displayTitle, fromSessionId: sessionId })
      .then(() => { threadsRevision.bump(); return refreshProjects() })
      .then(showProjects)
      .catch((failure: unknown) => {
        // The host refuses real cases (the session is not in a workspace, a blank title); with
        // the menu closed that refusal would vanish, so reopen it with the message above the item.
        setError(failure instanceof Error ? failure.message : String(failure))
        setMenuOpen(true)
      })
  }
  return (
    <>
      {error === null ? null : <div className="dsht-error dsht-menu-message" role="alert">{error}</div>}
      <MenuItemButton icon={<ProjectsIcon size={16} />} onSelect={run}>
        {t('menu.makeProject')}
      </MenuItemButton>
    </>
  )
}
