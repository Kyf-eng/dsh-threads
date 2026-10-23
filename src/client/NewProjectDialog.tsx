import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import { callHost, projectsStore, type ProjectView } from './api.ts'
import type { Translate } from './locale.ts'

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
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const folder = workspaceId || workspaces[0]?.workspaceId || ''

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const project = await callHost<ProjectView>('projects.create', { title, workspaceId: folder, instructions })
      await projectsStore.refresh()
      setTitle('')
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
          <Button variant="primary" disabled={busy || title.trim().length === 0 || folder.length === 0} onClick={() => { void submit() }}>
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
          {workspaces.length === 0
            ? <span className="dsht-hint">{t('new.noFolders')}</span>
            : (
                <select className="dsht-select" value={folder} onChange={(event) => setWorkspaceId(event.target.value)}>
                  {workspaces.map((workspace) => (
                    <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.title} — {workspace.path}</option>
                  ))}
                </select>
              )}
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
