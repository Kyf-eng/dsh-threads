// "新建项目", after Claude's: a name and a folder chosen with the system folder picker
// (Electron's on Desktop, the host's elsewhere; see `pickFolder` in index.tsx). A typed path
// is the fallback where no native picker exists (Web deployments whose picker only browses
// in-page), the same fallback the host's own "add workspace" has: asking for the folder then
// silently lands in the path field instead of failing.
//
// DOM shape matters: dsh-web-mobile (the phone layout plugin) treats any `[aria-modal="true"]`
// dialog whose FIRST child's LAST child holds a <button> as its settings sheet and transposes
// it into a row (`aria-modal > :first-child { flex-direction: row !important }`, plus hiding
// that child's first element). A form with its buttons as the last child matches by accident
// and the dialog collapses sideways on phones (2026-11-04 report). The body is therefore a
// plain wrapper and the form lives inside it, which keeps the dialog in the host's normal
// centred-card branch on every device.
import { Button, IconChevronDownOutlineRegular, Menu, MenuItemButton, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useEffect, useRef, useState } from 'react'
import { callHost, refreshProjects, type ProjectView } from './api.ts'
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

/**
 * A failed folder pick that means "there is no native chooser here" rather than a real error.
 * The host answers `directoryPicker.pick needs the native capability; the composed picker
 * serves "browse"` on Web, and Desktop answers `directory-picker/unavailable` — both send the
 * user to the path field.
 */
function pickerUnavailable(failure: unknown): boolean {
  const code = String((failure as { code?: unknown } | null)?.code ?? '')
  const message = failure instanceof Error ? failure.message : String(failure)
  return code.includes('unavailable') || /unavailable|needs the native capability|not supported|serves "browse"/i.test(message)
}

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
  /** The folder picker does not exist in this deployment, so the path field is the only way in. */
  const [typedOnly, setTypedOnly] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** An IME candidate window is open; Enter belongs to it, not to the form. */
  const composing = useRef(false)
  /** The dialog was dismissed while `projects.create` was in flight: do not navigate afterwards. */
  const abandoned = useRef(false)

  // The dialog stays mounted between openings: start each one fresh, with the preselected folder.
  useEffect(() => {
    if (!open) return
    setFolder(initialFolder ?? null)
    setTitle(initialFolder === null || initialFolder === undefined ? '' : basename(initialFolder))
    setNamed(false)
    setTyping(false)
    setTypedOnly(false)
    setRecentOpen(false)
    setError(null)
    setBusy(false)
    composing.current = false
    abandoned.current = false
  }, [open, initialFolder])

  const choose = (path: string) => {
    setFolder(path)
    if (!named) setTitle(basename(path))
  }

  const pick = async () => {
    if (busy) return
    setError(null)
    let picked: string | null | 'unavailable'
    try {
      picked = await pickFolder()
    } catch (failure) {
      if (pickerUnavailable(failure)) {
        setTypedOnly(true)
        setTyping(true)
        return
      }
      setError(t('new.pickFailed', { error: failure instanceof Error ? failure.message : String(failure) }))
      return
    }
    if (picked === 'unavailable') setTyping(true)
    else if (picked !== null) choose(picked)
  }

  const folderPath = (folder ?? '').trim()
  /** A typed folder still names the project after its basename, exactly like a picked one. */
  const effectiveTitle = title.trim().length > 0 ? title.trim() : named ? '' : basename(folderPath)
  const ready = folderPath.length > 0 && effectiveTitle.length > 0

  const close = () => {
    // Closing while the create is in flight is allowed (a stalled request must never trap the
    // dialog), but the result only navigates when the user is still looking at it.
    if (busy) abandoned.current = true
    setRecentOpen(false)
    onClose()
  }

  const submit = async () => {
    if (!ready || busy || composing.current) return
    setBusy(true)
    setError(null)
    abandoned.current = false
    try {
      const project = await callHost<ProjectView>('projects.create', { title: effectiveTitle, folder: folderPath })
      await refreshProjects()
      setBusy(false)
      if (abandoned.current) return
      setRecentOpen(false)
      onClose()
      onCreated(project)
    } catch (failure) {
      setBusy(false)
      if (abandoned.current) return
      setError(t('new.failed', { error: failure instanceof Error ? failure.message : String(failure) }))
    }
  }

  return (
    <Modal open={open} onClose={close} title={t('new.title')} headless className="dsht-dialog dsht-np">
      <div className="dsht-np-body">
        <form className="dsht-np-form" aria-busy={busy} onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <div className="dsht-dialog-head">
            <h2 className="dsht-dialog-title">{t('new.title')}</h2>
            <button type="button" className="dsht-icon-button" aria-label={t('common.close')} title={t('common.close')} onClick={close}>
              <CloseIcon />
            </button>
          </div>

          <label className="dsht-np-field">
            <span className="dsht-np-label">{t('new.name')}</span>
            <input className="dsht-np-input" value={title} placeholder={t('new.namePlaceholder')} maxLength={60} data-modal-autofocus
              onChange={(event) => { setTitle(event.target.value); setNamed(event.target.value.length > 0) }}
              onCompositionStart={() => { composing.current = true }}
              onCompositionEnd={() => { composing.current = false }} />
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
                      onSelect={() => { choose(workspace.path); setTyping(false); setTypedOnly(false); setRecentOpen(false) }}>
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
                  autoCapitalize="off" autoCorrect="off"
                  onChange={(event) => setFolder(event.target.value)}
                  onCompositionStart={() => { composing.current = true }}
                  onCompositionEnd={() => { composing.current = false }}
                  onBlur={() => { if (!named && (folder ?? '').trim().length > 0) setTitle(basename(folder ?? '')) }} />
                <span className="dsht-hint">{typedOnly ? t('new.pathOnly') : t('new.pathHint')}</span>
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
      </div>
    </Modal>
  )
}
