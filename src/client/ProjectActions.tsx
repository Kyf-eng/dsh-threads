// A project's actions, shared by the projects page cards and the sidebar's project rows: the "⋮"
// menu (pin, notifications, settings, archive, delete, with Claude's single-key shortcuts while it
// is open) and the settings dialog and delete confirmation it opens.
import {
  Button,
  IconArchiveOutlineRegular,
  IconCheckOutlineRegular,
  IconEllipsisOutlineRegular,
  IconPinFillRegular,
  IconPinOutlineRegular,
  IconSettingsOutlineRegular,
  IconTrashOutlineRegular,
  IconUnarchiveOutlineRegular,
  Menu,
  type MenuEntry,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { type ReactNode, useEffect, useState } from 'react'
import { callHost, type NotifyLevel, projectsStore, type ProjectView } from './api.ts'
import { BellIcon } from './icons.tsx'
import type { Translate } from './locale.ts'
import { ProjectSettings } from './ProjectSettings.tsx'
import { threadsRevision } from './threads.ts'

const NOTIFY_LEVELS: readonly NotifyLevel[] = ['all', 'attention', 'waiting', 'none']

export interface ProjectActions {
  togglePin: (project: ProjectView) => Promise<void>
  setNotify: (project: ProjectView, level: NotifyLevel) => Promise<void>
  openSettings: (project: ProjectView) => void
  toggleArchive: (project: ProjectView) => Promise<void>
  askDelete: (project: ProjectView) => void
}

/** The actions, plus the dialogs they open (render `dialogs` once next to the menus). */
export function useProjectActions({ projects, t, pinSession, afterArchive }: {
  projects: readonly ProjectView[]
  t: Translate
  pinSession: (sessionId: string, pinned: boolean) => Promise<void>
  /** Runs after an archive or unarchive (the projects page brings itself back). */
  afterArchive?: () => void
}): { actions: ProjectActions; dialogs: ReactNode; error: string | null } {
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ProjectView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      threadsRevision.bump()
      await projectsStore.refresh()
    }
  }

  const actions: ProjectActions = {
    togglePin: (project) => run(async () => {
      await callHost('projects.pin', { id: project.id, pinned: !project.pinned })
      await pinSession(project.mainSessionId, !project.pinned).catch(() => {})
    }),
    setNotify: (project, notify) => run(() => callHost('projects.update', { id: project.id, notify })),
    openSettings: (project) => setSettingsId(project.id),
    toggleArchive: (project) => run(async () => {
      await callHost(project.archived ? 'projects.unarchive' : 'projects.archive', { id: project.id })
      if (afterArchive !== undefined) setTimeout(afterArchive, 120)
    }),
    askDelete: (project) => setDeleting(project),
  }

  const remove = (project: ProjectView) => run(async () => {
    setDeleting(null)
    await callHost('projects.remove', { id: project.id })
    if (project.pinned) await pinSession(project.mainSessionId, false).catch(() => {})
  })

  const dialogs = (
    <>
      <ProjectSettings project={projects.find((p) => p.id === settingsId) ?? null} open={settingsId !== null} onClose={() => setSettingsId(null)} t={t} />
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting === null ? '' : t('delete.title', { title: deleting.title })}
        description={t('delete.description')}
        closeLabel={t('common.close')}
        footer={(
          <div className="dsht-buttons">
            <Button variant="ghost" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" className="dsht-danger" onClick={() => { if (deleting !== null) void remove(deleting) }}>{t('delete.confirm')}</Button>
          </div>
        )}
      />
    </>
  )

  return { actions, dialogs, error }
}

const SHORTCUTS: Record<string, 'pin' | 'settings' | 'archive' | 'delete'> = { p: 'pin', s: 'settings', a: 'archive', d: 'delete' }

/** The "⋮" button and its menu. */
export function ProjectMenu({ project, actions, t, onOpenChange }: {
  project: ProjectView
  actions: ProjectActions
  t: Translate
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpenState] = useState(false)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }

  const act = (id: string) => {
    setOpen(false)
    if (id === 'pin') void actions.togglePin(project)
    else if (id === 'settings') actions.openSettings(project)
    else if (id === 'archive') void actions.toggleArchive(project)
    else if (id === 'delete') actions.askDelete(project)
    else if (id.startsWith('notify:')) void actions.setNotify(project, id.slice('notify:'.length) as NotifyLevel)
  }

  // Claude's menu takes single keys while it is open: P pin, S settings, A archive, D delete.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const id = SHORTCUTS[event.key.toLowerCase()]
      if (id === undefined || (id === 'pin' && project.archived)) return
      event.preventDefault()
      event.stopPropagation()
      act(id)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project])

  const items: MenuEntry[] = [
    ...(project.archived ? [] : [{
      id: 'pin',
      label: project.pinned ? t('menu.unpin') : t('menu.pin'),
      icon: project.pinned ? <IconPinFillRegular size={16} /> : <IconPinOutlineRegular size={16} />,
      shortcut: { keys: ['P'] },
    }]),
    {
      id: 'notify',
      label: <span className="dsht-menu-aside-row"><span>{t('menu.notify')}</span><span className="dsht-menu-aside">{t(`notify.${project.notify}.short`)}</span></span>,
      icon: <BellIcon size={16} />,
      submenu: NOTIFY_LEVELS.map((level) => ({
        id: `notify:${level}`,
        icon: project.notify === level ? <IconCheckOutlineRegular size={16} /> : <span className="dsht-menu-icon-space" />,
        label: <span className="dsht-menu-two"><span>{t(`notify.${level}`)}</span><span className="dsht-menu-sub">{t(`notify.${level}.hint`)}</span></span>,
      })),
    },
    { id: 'settings', label: t('menu.settings'), icon: <IconSettingsOutlineRegular size={16} />, shortcut: { keys: ['S'] } },
    { type: 'separator', id: 'separator' },
    {
      id: 'archive',
      label: project.archived ? t('menu.unarchive') : t('menu.archive'),
      icon: project.archived ? <IconUnarchiveOutlineRegular size={16} /> : <IconArchiveOutlineRegular size={16} />,
      shortcut: { keys: ['A'] },
    },
    { id: 'delete', label: t('menu.delete'), icon: <IconTrashOutlineRegular size={16} />, danger: true, shortcut: { keys: ['D'] } },
  ]

  return (
    <Menu open={open} onClose={() => setOpen(false)} align="end" portal items={items} onSelect={act}
      anchor={(
        <button type="button" className="dsht-icon-button" aria-label={t('menu.more')} title={t('menu.more')}
          aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          <IconEllipsisOutlineRegular size={16} />
        </button>
      )} />
  )
}
