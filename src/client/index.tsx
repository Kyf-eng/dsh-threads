// Browser half. dist/client.js is wrapped in window.__ModuleLoader__.load by tsdown.config.ts.
// M2a: the "Projects" sidebar entry and page, and "Make project" in the session menu.
// M2c: thread cards in the transcript, "N 条回复", proposals above the composer.
// The sidebar's "Projects" section; project sessions leave DSH's workspace list (kinds.ts).
// M2b: threads open in the right sidebar with their own composer; a thread list tab;
// "讨论串 · N" / "回到主对话" in the conversation header; resolved threads lock their composer.
import type { Context } from '@deepseek-ai/cordis'
import type { ComponentType } from 'react'
import { NOTICE_NODE, noticeDefinition, OPENED_KEY, openedDefinition } from './chat.ts'
import { ProjectsIcon } from './icons.tsx'
import { syncKinds } from './kinds.ts'
import { startNotifications } from './notify.ts'
import { ProposalsDock } from './ProposalsDock.tsx'
import { NoticeCard, TurnThreadsCard } from './ThreadCards.tsx'
import { en, NS, type Translate, zh } from './locale.ts'
import { MakeProjectMenuItem } from './MakeProjectMenuItem.tsx'
import { ProjectsPage } from './ProjectsPage.tsx'
import { RESOLVED_KIND, type ResolvedInteraction, syncResolved } from './resolved.ts'
import { SidebarProjectsHost, useSidebarAnchor } from './SidebarProjects.tsx'
import { injectStyles } from './styles.ts'
import { ResolvedComposer, THREAD_CONVERSATION_SLOT, ThreadChatTab, ThreadConversation } from './ThreadChatTab.tsx'
import { ThreadsHeaderAction, ThreadsListTab } from './ThreadsList.tsx'
import { parseThreadAddress, THREAD_ADDRESS_PATTERN, threadAddress } from './threads.ts'

/** Sidebar entry id and `main` panel key. */
const PANEL_ID = 'dsh-threads-projects'
/** Right-sidebar tab types: the thread list (kind `dsh-threads`) and one thread's conversation. */
const LIST_TAB_ID = '@fky/dsh-threads'
const LIST_TAB_KIND = 'dsh-threads'
const CHAT_TAB_ID = '@fky/dsh-threads/chat'
const CHAT_TAB_KIND = 'dsh-threads.chat'

export const inject = ['slots', 'locale', 'layout', 'uiWorkspace', 'workspaces', 'sessions', 'resources', 'sidebarRight', 'sidebarRightTabs', 'uiSession', 'uiConversation']

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
  uiWorkspace: {
    openSession(sessionId: string): void
    /** The host's folder chooser; throws `directory-picker/unavailable` where folders are browsed in-page. */
    pickDirectory(): Promise<string | null>
  }
  workspaces: { pinSession(sessionId: string): Promise<void>; unpinSession(sessionId: string): Promise<void> }
  sessions: {
    retain(sessionId: string, options: { source: string; signal: AbortSignal }): { release(): void }
    list: { getSnapshot(): { byId: Record<string, { displayTitle?: string } | undefined> } }
  }
  resources: {
    register(provider: {
      protocol: string
      open(address: string, options: { signal: AbortSignal }): AsyncGenerator<{ ok: true; value: { threadId: string; reference: unknown } }>
    }): Disposer
  }
  sidebarRight: {
    openResource(address: string, options?: { kind?: string; preferNewPane?: boolean }): void
    openTab(kind: string, options?: { preferNewPane?: boolean }): void
  }
  sidebarRightTabs: {
    register(definition: {
      id: string
      kind: string
      patterns?: readonly string[]
      canOpen?: (address: string) => boolean
      title: (address: string) => string
      guide?: readonly { id: string; order: number; title: () => string; description: () => string }[]
    }): Disposer
  }
  uiConversation: { events: { register(definition: object): unknown } }
  uiSession: {
    registerPendingInteraction(precedence: (interaction: ResolvedInteraction) => number):
      (interaction: ResolvedInteraction, delegate: () => void) => () => void
    sessionStatus?: {
      getSnapshot(): ReadonlyMap<string, { running?: boolean }>
      subscribe(listener: () => void): () => void
    }
  }
}

function PanelIcon({ size }: { size: number; active: boolean }) {
  // Also marks the sidebar's panel <nav>, after which the "Projects" section is placed.
  const ref = useSidebarAnchor(size)
  return <span ref={ref} className="dsht-panel-icon"><ProjectsIcon size={size} /></span>
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))
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
  // The folder chooser DSH's own "add workspace" uses (dsh-client-ui-directory-picker-native):
  // Electron's dialog on Desktop, the host's picker otherwise.
  const pickFolder = async (): Promise<string | null | 'unavailable'> => {
    const desktop = (globalThis as { __DSH_DIRECTORY_PICKER__?: { pick(): Promise<string | null> } }).__DSH_DIRECTORY_PICKER__
    if (desktop !== undefined) return desktop.pick()
    try {
      return await ctx.uiWorkspace.pickDirectory()
    } catch (error) {
      if (String((error as { code?: unknown })?.code ?? error).includes('unavailable')) return 'unavailable'
      throw error
    }
  }
  const openThread = (threadId: string) => ctx.sidebarRight.openResource(threadAddress(threadId), { kind: CHAT_TAB_KIND })
  const openThreadsList = () => ctx.sidebarRight.openTab(LIST_TAB_KIND)

  // Projects page and its sidebar entry (M2a).
  ctx.slots.inject('main', () => ctx.slots.register(
    { name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ openSession, pinSession, pickFolder, showProjects }) },
    ProjectsPage as ComponentType<never>,
  ))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: PANEL_ID, order: 20, locale: NS, label: () => t('panel') },
    PanelIcon as ComponentType<never>,
  ))
  // The sidebar's own "Projects" section (SidebarProjects.tsx), portalled from an overlay entry.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'dsh-threads-sidebar-projects', locale: NS, inject: () => ({ openSession, pinSession, pickFolder }) },
    SidebarProjectsHost as ComponentType<never>,
  ))
  ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register(
    { name: 'sidebar.workspaces.session.menu.item', id: 'dsh-threads-make-project', order: 150, locale: NS, inject: () => ({ showProjects }) },
    MakeProjectMenuItem as ComponentType<never>,
  ))

  // A thread's conversation in the right sidebar: resource → tab type → body → embedded Conversation.
  ctx.effect(() => ctx.resources.register({
    protocol: 'dsh-threads',
    async *open(address, { signal }) {
      const threadId = parseThreadAddress(address)
      if (threadId === undefined) throw new Error(`dsh-threads: invalid thread address "${address}"`)
      if (signal.aborted) return
      const reference = ctx.sessions.retain(threadId, { source: 'dshThreads', signal })
      try {
        yield { ok: true, value: { threadId, reference } }
        await waitForAbort(signal)
      } finally {
        reference.release()
      }
    },
  }), 'dsh-threads: thread resources')
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: CHAT_TAB_ID,
    kind: CHAT_TAB_KIND,
    patterns: [THREAD_ADDRESS_PATTERN],
    canOpen: (address) => parseThreadAddress(address) !== undefined,
    title: (address) => {
      const id = parseThreadAddress(address)
      return (id === undefined ? undefined : ctx.sessions.list.getSnapshot().byId[id]?.displayTitle) ?? t('tab.thread')
    },
  }), 'dsh-threads: thread tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    {
      name: 'sidebar.right.pane.tab',
      key: CHAT_TAB_ID,
      locale: NS,
      inject: () => ({ openSession }),
      children: { [THREAD_CONVERSATION_SLOT]: { kind: 'single', scope: 'session' } },
    },
    ThreadChatTab as ComponentType<never>,
  ))
  ctx.slots.inject(THREAD_CONVERSATION_SLOT, () => ctx.slots.register(
    { name: THREAD_CONVERSATION_SLOT },
    ThreadConversation as ComponentType<never>,
  ))

  // The thread list tab, reachable from the guide page and the conversation header.
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: LIST_TAB_ID,
    kind: LIST_TAB_KIND,
    title: () => t('tab.title'),
    guide: [{ id: 'open', order: 70, title: () => t('tab.title'), description: () => t('tab.description') }],
  }), 'dsh-threads: thread list tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: LIST_TAB_ID, locale: NS, inject: (sessionId: string) => ({ sessionId, openThread, openSession }) },
    ThreadsListTab as ComponentType<never>,
  ))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
    { name: 'conversation.session.header.actions', id: 'dsh-threads', order: 15, locale: NS, inject: () => ({ openThreadsList, openSession }) },
    ThreadsHeaderAction as ComponentType<never>,
  ))

  // Transcript cards (M2c): our notices become thread cards; a turn that opened threads ends
  // with an "N 条回复" card; proposals wait above the composer. Sidebar: thread rows are hidden
  // and their main conversation's row shows ↳N and the threads' state (kinds.ts).
  ctx.uiConversation.events.register(noticeDefinition)
  ctx.uiConversation.events.register(openedDefinition)
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
    { name: 'conversation.chat.node', key: NOTICE_NODE, locale: NS, inject: () => ({ openThread }) },
    NoticeCard as ComponentType<never>,
  ))
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register(
    { name: 'conversation.chat.turnTail', id: OPENED_KEY, order: 25, locale: NS, inject: (sessionId: string) => ({ sessionId, openThread }) },
    TurnThreadsCard as ComponentType<never>,
  ))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
    { name: 'conversation.input.dock', id: 'dsh-threads-proposals', order: 15, locale: NS, inject: (sessionId: string) => ({ sessionId }) },
    ProposalsDock as ComponentType<never>,
  ))
  ctx.effect(() => syncKinds(ctx.uiSession.sessionStatus), 'dsh-threads: session kinds')
  ctx.effect(() => startNotifications({ status: ctx.uiSession.sessionStatus, openSession, openThread, t }), 'dsh-threads: notifications')

  // Resolved threads: a pending interaction per thread selects ResolvedComposer.
  const publishResolved = ctx.uiSession.registerPendingInteraction(() => 0)
  ctx.effect(() => syncResolved(publishResolved, ctx.uiSession.sessionStatus), 'dsh-threads: resolved threads')
  ctx.slots.inject('conversation.composer', () => ctx.slots.register(
    {
      name: 'conversation.composer',
      select: ({ pendingInteraction }: { pendingInteraction?: { kind?: string } }) =>
        (pendingInteraction?.kind === RESOLVED_KIND ? pendingInteraction : null),
      locale: NS,
    },
    ResolvedComposer as ComponentType<never>,
  ))
}
