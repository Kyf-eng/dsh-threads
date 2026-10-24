import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import { callHost, projectsStore, type ProjectView } from './api.ts'
import type { Translate } from './locale.ts'

const OTHER = '__dsh-threads-other-folder__'

export interface WorkspaceOption {
  workspaceId: string
  title: string
  path: string
}

export function NewProjectDialog({ open, onClose, onCreated, workspaces, t }: {
  open: boolean
  onClose: () => void
  onCreated: (project: ProjectView) => void
  workspaces: readonly WorkspaceOption[]
  t: Translate
}) {
  const [title, setTitle] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [path, setPath] = useState('')
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Any folder, as in Claude: an existing workspace, or a path the host adds as a workspace.
  const choice = workspaceId || workspaces[0]?.workspaceId || OTHER
  const byPath = choice === OTHER
  const ready = title.trim().length > 0 && (byPath ? path.trim().length > 0 : choice.length > 0)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const target = byPath ? { folder: path.trim() } : { workspaceId: choice }
      const project = await callHost<ProjectView>('projects.create', { title, ...target, instructions })
      await projectsStore.refresh()
      setTitle('')
      setPath('')
      setInstructions('')
      onCreated(project)
    } catch (failure) {
      setError(t('new.failed', { error: failure instanceof Error ? failure.message : String(failure) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('new.title')}
      closeLabel={t('common.close')}
      footer={(
        <div className="dsht-buttons">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={busy || !ready} onClick={() => { void submit() }}>
            {t('new.create')}
          </Button>
        </div>
      )}
    >
      <form className="dsht-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <label className="dsht-field">
          <span className="dsht-field-label">{t('new.name')}</span>
          <input className="dsht-text" value={title} placeholder={t('new.namePlaceholder')} data-modal-autofocus
            onChange={(event) => setTitle(event.target.value)} maxLength={60} />
        </label>
        <label className="dsht-field">
          <span className="dsht-field-label">{t('new.folder')}</span>
          {workspaces.length === 0 ? null : (
            <select className="dsht-select" value={choice} onChange={(event) => setWorkspaceId(event.target.value)}>
              {workspaces.map((workspace) => (
                <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.title} — {workspace.path}</option>
              ))}
              <option value={OTHER}>{t('new.otherFolder')}</option>
            </select>
          )}
          {byPath ? (
            <input className="dsht-text dsht-mono" value={path} placeholder={t('new.pathPlaceholder')} spellCheck={false}
              onChange={(event) => setPath(event.target.value)} />
          ) : null}
          {byPath ? <span className="dsht-hint">{t('new.pathHint')}</span> : null}
        </label>
        <label className="dsht-field">
          <span className="dsht-field-label">{t('new.instructions')}</span>
          <textarea className="dsht-textarea" value={instructions} placeholder={t('new.instructionsPlaceholder')}
            onChange={(event) => setInstructions(event.target.value)} maxLength={4000} />
        </label>
        {error === null ? null : <div className="dsht-error">{error}</div>}
      </form>
    </Modal>
  )
}
