// Browser half. dist/client.js is wrapped in window.__ModuleLoader__.load by tsdown.config.ts.
// M0: register an empty right-sidebar "Threads" tab and ping the host over Connection RPC.
import type { Context } from '@deepseek-ai/cordis'
import { useEffect, useState } from 'react'

/** Tab implementation id: the package name, as the right sidebar expects. */
const TAB_ID = '@fky/dsh-threads'
const TAB_KIND = 'dsh-threads'
/**
 * Host route, relative to the page like DSH's own Connection calls: on Desktop the page is
 * dsh-app://app/ and the shell forwards it to the Host with its cookie; on Web it is same-origin.
 * Must match RPC_PATH in src/rpc.ts.
 */
const RPC_URL = 'api/dsh-threads'

export const inject = ['slots', 'sidebarRightTabs']

type Disposer = () => void

// Narrow views of the host services this file touches; the published slot types
// depend on packages that are not on npm, so M0 does not import them.
interface ClientContext {
  effect(body: () => Disposer, label?: string): void
  slots: {
    inject(name: string, body: () => Disposer): void
    register(options: {
      name: string
      key: string
      inject: (sessionId: string) => TabInjected
    }, component: (props: TabProps) => JSX.Element): Disposer
  }
  sidebarRightTabs: {
    register(definition: {
      id: string
      kind: string
      title: (address: string) => string
      guide?: readonly { id: string; order: number; title: () => string; description: () => string }[]
    }): Disposer
  }
}

async function callHost(method: string, payload: unknown = {}): Promise<unknown> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, payload }),
  })
  const body = await response.json().catch(() => ({})) as { result?: unknown; error?: string }
  if (!response.ok) throw new Error(`HTTP ${response.status}${body.error === undefined ? '' : `: ${body.error}`}`)
  return body.result
}

interface TabInjected {
  ping: () => Promise<unknown>
}

interface TabProps extends TabInjected {
  sessionId?: string
}

const isZh = () => typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
const title = () => (isZh() ? '讨论串' : 'Threads')

function ThreadsTab({ sessionId, ping }: TabProps) {
  const [rpc, setRpc] = useState('…')
  useEffect(() => {
    let live = true
    ping().then(
      (value) => { if (live) setRpc(JSON.stringify(value)) },
      (error: unknown) => { if (live) setRpc(`failed: ${String(error)}`) },
    )
    return () => { live = false }
  }, [ping])
  return (
    <div style={{ padding: 12, fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 600 }}>{title()}</div>
      <div>{isZh() ? 'M0 占位：讨论串列表在 M2 实现。' : 'M0 placeholder: the thread list arrives in M2.'}</div>
      <div>session: {sessionId ?? '—'}</div>
      <div>host RPC: {rpc}</div>
    </div>
  )
}

export function apply(root: Context): void {
  const ctx = root as unknown as ClientContext
  const ping = () => callHost('ping')
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_KIND,
    title,
    guide: [{
      id: 'open',
      order: 70,
      title,
      description: () => (isZh() ? '主对话开出的讨论串' : 'Threads opened by the main conversation'),
    }],
  }), 'dsh-threads: sidebar tab')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: TAB_ID,
    inject: () => ({ ping }),
  }, ThreadsTab))
}
