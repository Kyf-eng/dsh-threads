// The "模型" rows of the project settings (coordinator / thread model and thinking strength,
// as in Claude's) and the "使用情况" page. Models come from DSH's own catalog (`models.catalog`);
// a choice of "默认" follows DSH's default model.
import { IconChevronDownOutlineRegular, Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import type { ModelChoice, ProjectView } from './api.ts'
import type { MessageKey, Translate } from './locale.ts'
import { useHostValue } from './threads.ts'

interface Effort {
  id: string
  name: string
}

interface CatalogModel {
  id: string
  name: string
  reasoning?: { efforts: Effort[]; defaultEffort?: string }
}

/** Mirrors DSH's ModelCatalog (dsh-api-session-controller). */
export interface ModelCatalog {
  default: ModelChoice
  groups: { id: string; name: string; models: CatalogModel[] }[]
}

const DEFAULT = 'default'
const key = (provider: string, model: string) => `${provider}\u0000${model}`

function findModel(catalog: ModelCatalog | undefined, choice: ModelChoice | null): CatalogModel | undefined {
  if (catalog === undefined) return undefined
  const target = choice ?? catalog.default
  return catalog.groups.find((group) => group.id === target.provider)?.models.find((model) => model.id === target.model)
}

/** A menu dressed as a select box, as DSH's own settings do it (there is no Select primitive). */
function SelectMenu({ value, label, items, onSelect, disabled }: {
  value: string
  label: string
  items: MenuEntry[]
  onSelect: (id: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Menu open={open} onClose={() => setOpen(false)} align="end" portal selection="check" selectedId={value} items={items}
      onSelect={(id) => { setOpen(false); onSelect(id) }}
      anchor={(
        <button type="button" className="dsht-select-box" disabled={disabled} aria-haspopup="menu" aria-expanded={open}
          onClick={() => setOpen(!open)}>
          <span className="dsht-select-box-text">{label}</span>
          <IconChevronDownOutlineRegular size={14} />
        </button>
      )} />
  )
}

function ModelPair({ choice, catalog, modelTitle, modelHint, effortTitle, effortHint, onChange, t }: {
  choice: ModelChoice | null
  catalog: ModelCatalog | undefined
  modelTitle: MessageKey
  modelHint: MessageKey
  effortTitle: MessageKey
  effortHint: MessageKey
  onChange: (next: ModelChoice | null) => void
  t: Translate
}) {
  const defaultModel = findModel(catalog, null)
  const model = findModel(catalog, choice)
  const modelItems: MenuEntry[] = [
    { id: DEFAULT, label: t('settings.default', { name: defaultModel?.name ?? catalog?.default.model ?? '…' }) },
    ...(catalog?.groups ?? []).flatMap((group): MenuEntry[] => [
      { type: 'separator', id: `sep:${group.id}` },
      { type: 'label', id: `label:${group.id}`, text: group.name },
      ...group.models.map((item) => ({ id: key(group.id, item.id), label: item.name })),
    ]),
  ]
  const modelValue = choice === null ? DEFAULT : key(choice.provider, choice.model)
  const modelLabel = choice === null ? t('settings.default', { name: defaultModel?.name ?? catalog?.default.model ?? '…' }) : model?.name ?? choice.model

  // Efforts of the chosen model; "默认" leaves the model's own default in place.
  const efforts = model?.reasoning?.efforts ?? []
  const effortDefault = efforts.find((effort) => effort.id === (choice === null ? catalog?.default.reasoningEffort : model?.reasoning?.defaultEffort))
  const effortItems: MenuEntry[] = [
    { id: DEFAULT, label: t('settings.default', { name: effortDefault?.name ?? '—' }) },
    ...efforts.map((effort) => ({ id: effort.id, label: effort.name })),
  ]
  const effortValue = choice?.reasoningEffort ?? DEFAULT
  const effortLabel = choice?.reasoningEffort === undefined
    ? t('settings.default', { name: effortDefault?.name ?? '—' })
    : efforts.find((effort) => effort.id === choice.reasoningEffort)?.name ?? choice.reasoningEffort

  return (
    <>
      <div className="dsht-setting-row">
        <div className="dsht-setting-text">
          <div className="dsht-setting-title">{t(modelTitle)}</div>
          <div className="dsht-setting-hint">{t(modelHint)}</div>
        </div>
        <SelectMenu value={modelValue} label={catalog === undefined ? t('settings.loadingModels') : modelLabel} items={modelItems}
          disabled={catalog === undefined}
          onSelect={(id) => {
            if (id === DEFAULT) return onChange(null)
            const [provider, modelId] = id.split('\u0000')
            if (provider !== undefined && modelId !== undefined) onChange({ provider, model: modelId })
          }} />
      </div>
      <div className="dsht-setting-row">
        <div className="dsht-setting-text">
          <div className="dsht-setting-title">{t(effortTitle)}</div>
          <div className="dsht-setting-hint">{t(effortHint)}</div>
        </div>
        <SelectMenu value={effortValue} label={effortLabel} items={effortItems}
          disabled={catalog === undefined || choice === null || efforts.length === 0}
          onSelect={(id) => {
            if (choice === null) return
            const { reasoningEffort: _previous, ...rest } = choice
            onChange(id === DEFAULT ? rest : { ...rest, reasoningEffort: id })
          }} />
      </div>
    </>
  )
}

/** The four model rows; each change saves at once (the coordinator model applies to the main conversation). */
export function ModelSettings({ project, open, save, t }: {
  project: ProjectView
  open: boolean
  save: (patch: { mainModel?: ModelChoice | null; threadModel?: ModelChoice | null }) => Promise<void>
  t: Translate
}) {
  const catalog = useHostValue<ModelCatalog>(open ? 'models.catalog' : null, {}, [open])
  return (
    <div className="dsht-setting-group">
      <div className="dsht-setting-group-title">{t('settings.models')}</div>
      <ModelPair choice={project.mainModel} catalog={catalog} t={t}
        modelTitle="settings.mainModel" modelHint="settings.mainModelHint" effortTitle="settings.mainEffort" effortHint="settings.mainEffortHint"
        onChange={(next) => { void save({ mainModel: next }) }} />
      <ModelPair choice={project.threadModel} catalog={catalog} t={t}
        modelTitle="settings.threadModel" modelHint="settings.threadModelHint" effortTitle="settings.threadEffort" effortHint="settings.threadEffortHint"
        onChange={(next) => { void save({ threadModel: next }) }} />
    </div>
  )
}

interface UsageRow {
  sessionId: string
  kind: 'main' | 'thread'
  n: number | null
  title: string
  input: number
  output: number
}

function tokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  return String(value)
}

/** "使用情况": tokens of the main conversation and every thread, read from DSH's usage projections. */
export function UsageSection({ project, t }: { project: ProjectView; t: Translate }) {
  const usage = useHostValue<{ total: { input: number; output: number }; rows: UsageRow[] }>('projects.usage', { id: project.id }, [project.id])
  if (usage === undefined) return <div className="dsht-setting-hint dsht-usage-loading">{t('usage.loading')}</div>
  return (
    <div className="dsht-setting-block">
      <div className="dsht-setting-hint">{t('usage.hint')}</div>
      <div className="dsht-usage-total">
        <div><span className="dsht-usage-figure">{tokens(usage.total.input)}</span><span className="dsht-setting-hint">{t('usage.input')}</span></div>
        <div><span className="dsht-usage-figure">{tokens(usage.total.output)}</span><span className="dsht-setting-hint">{t('usage.output')}</span></div>
      </div>
      <table className="dsht-usage-table">
        <thead>
          <tr><th>{t('usage.session')}</th><th>{t('usage.input')}</th><th>{t('usage.output')}</th></tr>
        </thead>
        <tbody>
          {usage.rows.map((row) => (
            <tr key={row.sessionId}>
              <td>{row.kind === 'main' ? t('usage.main') : <><span className="dsht-item-n">#{row.n}</span>{row.title}</>}</td>
              <td>{tokens(row.input)}</td>
              <td>{tokens(row.output)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
