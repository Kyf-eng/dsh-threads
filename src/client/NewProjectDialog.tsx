// "新建项目", after Claude's: a name and a folder chosen with the system folder picker
// (Electron's on Desktop, the host's elsewhere; see `pickFolder` in index.tsx). A typed path
// is the fallback only where no picker exists (Web deployments that browse folders in-page).
import { Button, IconChevronDownOutlineRegular, Menu, MenuItemButton, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useState } from 'react'
import { callHost, projectsStore, type ProjectView } from './api.ts'
import { FolderIcon } from './icons.tsx'
import type { Translate } from './locale.ts'
import { CloseIcon } from './ui.tsx'

export interface WorkspaceOption {
  workspaceId: string
  title: string
  path: string
}

/** A folder path, null when the user cancelled, or 'unavailable' when there is no picker here. */
export type PickFolder = () => Promise<string | null | 'unavailable'>

const basename = (path: string) => path.split(/[\\/]/).filter((part) => part.length > 0).pop() ?? path

export function NewProjectDialog({ open, initialFolder, onClose, onCreated, workspaces, pickFolder, t }: {
  open: boolean
  /** Preselected folder (the page's "new from workspace" menu). */
  initialFolder?: string | null
  onClose: () => void
  onCreated: (project: ProjectView) => void
  workspaces: readonly WorkspaceOption[]
  pickFolder: PickFolder
  t: Translate
}) {
  const [title, setTitle] = useState('')
  /** The user typed the name; picking a folder no longer overwrites it. */
  const [named, setNamed] = useState(false)
  const [folder, setFolder] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // The dialog stays mounted between openings: start each one fresh, with the preselected folder.
  useEffect(() => {
    if (!open) return
    setFolder(initialFolder ?? null)
    setTitle(initialFolder === null || initialFolder === undefined ? '' : basename(initialFolder))
    setNamed(false)
    setTyping(false)
    setError(null)
  }, [open, initialFolder])

  const choose = (path: string) => {
    setFolder(path)
    if (!named) setTitle(basename(path))
  }

  const pick = async () => {
    setError(null)
    let picked: string | null | 'unavailable'
    try {
      picked = await pickFolder()
    } catch (failure) {
      setError(t('new.pickFailed', { error: failure instanceof Error ? failure.message : String(failure) }))
      return
    }
    if (picked === 'unavailable') setTyping(true)
    else if (picked !== null) choose(picked)
  }

  const close = () => {
    setRecentOpen(false)
    onClose()
  }

  const ready = title.trim().length > 0 && (folder ?? '').trim().length > 0
  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      const project = await callHost<ProjectView>('projects.create', { title, folder: (folder ?? '').trim() })
      await projectsStore.refresh()
      close()
      onCreated(project)
    } catch (failure) {
      setError(t('new.failed', { error: failure instanceof Error ? failure.message : String(failure) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title={t('new.title')} headless className="dsht-dialog dsht-np">
      <form className="dsht-np-body" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <div className="dsht-dialog-head">
          <h2 className="dsht-dialog-title">{t('new.title')}</h2>
          <button type="button" className="dsht-icon-button" aria-label={t('common.close')} title={t('common.close')} onClick={close}>
            <CloseIcon />
          </button>
        </div>

        <label className="dsht-np-field">
          <span className="dsht-np-label">{t('new.name')}</span>
          <input className="dsht-np-input" value={title} placeholder={t('new.namePlaceholder')} maxLength={60} data-modal-autofocus
            onChange={(event) => { setTitle(event.target.value); setNamed(event.target.value.length > 0) }} />
        </label>

        <div className="dsht-np-field">
          <div className="dsht-np-label-row">
            <span className="dsht-np-label">{t('new.folder')}</span>
            {workspaces.length === 0 ? null : (
              <Menu open={recentOpen} onClose={() => setRecentOpen(false)} align="end" portal
                anchor={(
                  <button type="button" className="dsht-np-link" onClick={() => setRecentOpen(!recentOpen)}>
                    {t('new.recent')}<IconChevronDownOutlineRegular size={14} />
                  </button>
                )}>
                {workspaces.map((workspace) => (
                  <MenuItemButton key={workspace.workspaceId} icon={<FolderIcon size={16} />}
                    onSelect={() => { choose(workspace.path); setTyping(false); setRecentOpen(false) }}>
                    <span className="dsht-menu-two">
                      <span>{workspace.title}</span>
                      <span className="dsht-menu-sub">{workspace.path}</span>
                    </span>
                  </MenuItemButton>
                ))}
              </Menu>
            )}
          </div>
          {typing ? (
            <>
              <input className="dsht-np-input dsht-mono" value={folder ?? ''} placeholder={t('new.pathPlaceholder')} spellCheck={false}
                onChange={(event) => setFolder(event.target.value)}
                onBlur={() => { if (!named && (folder ?? '').trim().length > 0) setTitle(basename(folder ?? '')) }} />
              <span className="dsht-hint">{t('new.pathHint')}</span>
            </>
          ) : (
            <button type="button" className={`dsht-np-folder${folder === null ? ' dsht-np-folder-empty' : ''}`} onClick={() => { void pick() }}>
              <FolderIcon size={18} />
              {folder === null
                ? <span className="dsht-np-folder-text">{t('new.chooseFolder')}</span>
                : (
                    <span className="dsht-np-folder-text">
                      <span className="dsht-np-folder-name">{basename(folder)}</span>
                      <span className="dsht-np-folder-path">{folder}</span>
                    </span>
                  )}
              {folder === null ? null : <span className="dsht-np-change">{t('new.change')}</span>}
            </button>
          )}
        </div>

        {error === null ? null : <div className="dsht-error">{error}</div>}

        <div className="dsht-dialog-actions">
          <Button variant="ghost" type="button" onClick={close}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={busy || !ready}>{t('new.create')}</Button>
        </div>
      </form>
    </Modal>
  )
}
