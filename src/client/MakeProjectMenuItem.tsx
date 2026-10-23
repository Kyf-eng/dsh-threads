import { MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useState } from 'react'
import { callHost, projectsStore } from './api.ts'
import { ProjectsIcon } from './icons.tsx'
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

  useEffect(() => {
    let live = true
    callHost<{ project: unknown; thread: boolean }>('sessions.role', { id: sessionId }).then(
      (role) => { if (live) setEligible(role.project === null && !role.thread) },
      () => { if (live) setEligible(false) },
    )
    return () => { live = false }
  }, [sessionId])

  if (!eligible) return null
  return (
    <MenuItemButton
      icon={<ProjectsIcon size={16} />}
      onSelect={() => {
        setMenuOpen(false)
        void callHost('projects.create', { title: displayTitle, fromSessionId: sessionId })
          .then(() => projectsStore.refresh())
          .then(showProjects)
      }}
    >
      {t('menu.makeProject')}
    </MenuItemButton>
  )
}
