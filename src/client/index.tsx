// Browser half. dist/client.js is wrapped in window.__ModuleLoader__.load by tsdown.config.ts.
// M2a: the "Projects" sidebar entry and page, and "Make project" in the session menu.
// The right-sidebar "Threads" tab is still a placeholder until M2b.
import type { Context } from '@deepseek-ai/cordis'
import type { ComponentType } from 'react'
import { ProjectsIcon } from './icons.tsx'
import { en, NS, type Translate, zh } from './locale.ts'
import { MakeProjectMenuItem } from './MakeProjectMenuItem.tsx'
import { ProjectsPage } from './ProjectsPage.tsx'
import { injectStyles } from './styles.ts'

/** Sidebar entry id and `main` panel key. */
const PANEL_ID = 'dsh-threads-projects'
/** Right-sidebar tab implementation id: the package name. */
const TAB_ID = '@fky/dsh-threads'

export const inject = ['slots', 'locale', 'layout', 'uiWorkspace', 'workspaces', 'sidebarRightTabs']

type Disposer = () => void

// Narrow views of the host services this file touches (their published slot types pull in
// packages that are not on npm).
interface ClientContext {
  effect(body: () => Disposer, label?: string): void
  slots: {
    inject(name: string, body: () => Disposer): void
    register(options: Record<string, unknown>, component: ComponentType<never>): Disposer
  }
  locale: {
    register(ns: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): Disposer
    bind(ns: string): (key: string, params?: Record<string, string | number>) => string
  }
  layout: { selectPanel(id: string | null): void }
  uiWorkspace: { openSession(sessionId: string): void }
  workspaces: { pinSession(sessionId: string): Promise<void>; unpinSession(sessionId: string): Promise<void> }
  sidebarRightTabs: {
    register(definition: {
      id: string
      kind: string
      title: (address: string) => string
      guide?: readonly { id: string; order: number; title: () => string; description: () => string }[]
    }): Disposer
  }
}

function PanelIcon({ size }: { size: number; active: boolean }) {
  return <ProjectsIcon size={size} />
}

function ThreadsTab({ t }: { t: Translate }) {
  return <div className="dsht-tab">{t('tab.description')}</div>
}

export function apply(root: Context): void {
  const ctx = root as unknown as ClientContext
  ctx.effect(() => injectStyles(), 'dsh-threads: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-threads: locale')
  const t = ctx.locale.bind(NS) as Translate

  const openSession = (sessionId: string) => ctx.uiWorkspace.openSession(sessionId)
  const pinSession = (sessionId: string, pinned: boolean) =>
    (pinned ? ctx.workspaces.pinSession(sessionId) : ctx.workspaces.unpinSession(sessionId))
  const showProjects = () => ctx.layout.selectPanel(PANEL_ID)

  ctx.slots.inject('main', () => ctx.slots.register(
    { name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ openSession, pinSession }) },
    ProjectsPage as ComponentType<never>,
  ))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: PANEL_ID, order: 20, locale: NS, label: () => t('panel') },
    PanelIcon as ComponentType<never>,
  ))
  ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register(
    { name: 'sidebar.workspaces.session.menu.item', id: 'dsh-threads-make-project', order: 150, locale: NS, inject: () => ({ showProjects }) },
    MakeProjectMenuItem as ComponentType<never>,
  ))

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: 'dsh-threads',
    title: () => t('tab.title'),
    guide: [{ id: 'open', order: 70, title: () => t('tab.title'), description: () => t('tab.description') }],
  }), 'dsh-threads: sidebar tab')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS },
    ThreadsTab as ComponentType<never>,
  ))
}
