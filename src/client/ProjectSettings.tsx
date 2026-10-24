// Project settings, after Claude's (left navigation; rows of title, description and control).
// Text fields save when they lose focus and when the dialog closes; the icon saves at once.
import { IconSettingsOutlineRegular, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { type ReactNode, useEffect, useState } from 'react'
import { callHost, projectsStore, type ProjectView } from './api.ts'
import { PROJECT_ICON_IDS, ProjectIcon } from './icons.tsx'
import type { MessageKey, Translate } from './locale.ts'
import { CloseIcon } from './ui.tsx'

const GOAL_MAX = 8000
const MEMORY_MAX = 4000

type Section = 'general' | 'memory'

const SECTIONS: readonly { id: Section; label: MessageKey; icon: ReactNode }[] = [
  { id: 'general', label: 'settings.general', icon: <IconSettingsOutlineRegular size={16} /> },
  { id: 'memory', label: 'settings.memory', icon: <ProjectIcon id="book" size={16} /> },
]

type Patch = Partial<Pick<ProjectView, 'title' | 'icon' | 'goal' | 'instructions'>>

export function ProjectSettings({ project, open, onClose, t }: {
  project: ProjectView | null
  open: boolean
  onClose: () => void
  t: Translate
}) {
  const [section, setSection] = useState<Section>('general')
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [memory, setMemory] = useState('')
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || project === null) return
    setTitle(project.title)
    setGoal(project.goal)
    setMemory(project.instructions)
    setPicking(false)
    setError(null)
    // Only when a project opens: later list refreshes must not overwrite what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id])

  if (project === null) return null

  const save = async (patch: Patch) => {
    const changed = Object.entries(patch).some(([key, value]) => project[key as keyof Patch] !== value)
    if (!changed) return
    setError(null)
    try {
      await callHost('projects.update', { id: project.id, ...patch })
      await projectsStore.refresh()
    } catch (failure) {
      setError(t('settings.saveFailed', { error: failure instanceof Error ? failure.message : String(failure) }))
    }
  }

  const close = () => {
    void save({ title: title.trim().length > 0 ? title : project.title, goal, instructions: memory })
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title={t('settings.title')} headless className="dsht-dialog dsht-settings">
      <div className="dsht-settings-layout">
        <nav className="dsht-settings-nav" aria-label={t('settings.title')}>
          <div className="dsht-settings-nav-title">{t('settings.title')}</div>
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" className={`dsht-settings-nav-item${section === item.id ? ' is-active' : ''}`}
              aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}>
              {item.icon}<span>{t(item.label)}</span>
            </button>
          ))}
        </nav>

        <div className="dsht-settings-main">
          <div className="dsht-settings-head">
            <h2 className="dsht-dialog-title">{t(section === 'general' ? 'settings.general' : 'settings.memory')}</h2>
            <button type="button" className="dsht-icon-button" aria-label={t('common.close')} title={t('common.close')} onClick={close}>
              <CloseIcon />
            </button>
          </div>

          <div className="dsht-settings-body">
            {error === null ? null : <div className="dsht-error">{error}</div>}
            {section === 'general' ? (
              <>
                <div className="dsht-setting-row">
                  <div className="dsht-setting-text"><div className="dsht-setting-title">{t('settings.nameIcon')}</div></div>
                  <div className="dsht-name-field">
                    <button type="button" className="dsht-icon-pick" aria-label={t('settings.chooseIcon')} title={t('settings.chooseIcon')}
                      aria-expanded={picking} onClick={() => setPicking(!picking)}>
                      <ProjectIcon id={project.icon} size={18} />
                    </button>
                    <input className="dsht-name-input" value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)}
                      onBlur={() => { if (title.trim().length > 0) void save({ title }) }} />
                  </div>
                </div>
                {picking ? (
                  <div className="dsht-icon-grid" role="listbox" aria-label={t('settings.chooseIcon')}>
                    {PROJECT_ICON_IDS.map((id) => (
                      <button key={id} type="button" role="option" aria-selected={project.icon === id}
                        className={`dsht-icon-cell${project.icon === id ? ' is-active' : ''}`}
                        onClick={() => { void save({ icon: id }); setPicking(false) }}>
                        <ProjectIcon id={id} size={18} />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="dsht-setting-block">
                  <div className="dsht-setting-title">{t('settings.goal')}</div>
                  <div className="dsht-setting-hint">{t('settings.goalHint')}</div>
                  <textarea className="dsht-setting-textarea" value={goal} maxLength={GOAL_MAX} placeholder={t('settings.goalPlaceholder')}
                    onChange={(event) => setGoal(event.target.value)} onBlur={() => { void save({ goal }) }} />
                  <div className="dsht-counter">{goal.length.toLocaleString()} / {GOAL_MAX.toLocaleString()}</div>
                </div>

                <div className="dsht-setting-block">
                  <div className="dsht-setting-title">{t('settings.folder')}</div>
                  <div className="dsht-setting-hint">{t('settings.folderHint')}</div>
                  <div className="dsht-setting-path dsht-mono" title={project.folder}>{project.folder}</div>
                </div>
              </>
            ) : (
              <div className="dsht-setting-block">
                <div className="dsht-setting-title">{t('settings.instructions')}</div>
                <div className="dsht-setting-hint">{t('settings.instructionsHint')}</div>
                <textarea className="dsht-setting-textarea dsht-setting-textarea-tall" value={memory} maxLength={MEMORY_MAX}
                  placeholder={t('settings.instructionsPlaceholder')}
                  onChange={(event) => setMemory(event.target.value)} onBlur={() => { void save({ instructions: memory }) }} />
                <div className="dsht-counter">{memory.length.toLocaleString()} / {MEMORY_MAX.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
