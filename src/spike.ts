// M0 spike (b)/(e): open one real session the way a thread will be opened, and tag its
// first message with our own source kind. Replaced by manager.ts in M1.
import { randomUUID } from 'node:crypto'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm'
import { optional } from './probe.ts'
import { SOURCE_KIND } from './source.ts'

interface ControllerLike {
  create(request: { workspaceId?: string; sessionId?: string }): Promise<{ sessionId: string; agentPreset?: string }>
  resolveAgent(sessionId: string): Promise<{ agent: Agent } | { error: { message: string } }>
}

interface WorkspaceRegistryLike {
  list(): readonly { id: string; path: string; sessionIds: readonly string[] }[]
}

interface SessionTitleLike {
  rename(session: Agent['session'], title: string): unknown
}

export type SpawnProbeResult =
  | { ok: true; sessionId: string; workspaceId: string | null; agentPreset: string | null; renamed: boolean }
  | { ok: false; step: string; error: string; sessionId?: string }

const PROBE_TITLE = 'dsh-threads probe'
const PROBE_TASK = 'This is a dsh-threads M0 probe. Reply with the single word OK and do nothing else.'

export async function spawnProbe(ctx: object, caller: Agent): Promise<SpawnProbeResult> {
  const controller = optional<ControllerLike>(ctx, 'sessionController')
  if (controller === undefined) return { ok: false, step: 'inject', error: 'sessionController is not available to this plugin' }
  const workspace = optional<WorkspaceRegistryLike>(ctx, 'workspaceRegistry')
    ?.list()
    .find((candidate) => candidate.sessionIds.includes(caller.id))

  let sessionId: string
  let agentPreset: string | null
  try {
    const created = await controller.create({
      ...(workspace === undefined ? {} : { workspaceId: workspace.id }),
      // Same shape DSH mints itself (dsh-api-session-controller: `session-${randomUUID()}`).
      sessionId: `session-${randomUUID()}`,
    })
    sessionId = created.sessionId
    agentPreset = created.agentPreset ?? null
  } catch (error) {
    return { ok: false, step: 'create', error: String(error) }
  }

  const resolved = await controller.resolveAgent(sessionId)
  if ('error' in resolved) return { ok: false, step: 'resolveAgent', error: resolved.error.message, sessionId }

  let renamed = false
  try {
    optional<SessionTitleLike>(ctx, 'sessionTitle')?.rename(resolved.agent.session, PROBE_TITLE)
    renamed = true
  } catch {
    // Title is cosmetic for the probe; the result reports whether it worked.
  }

  try {
    resolved.agent.followup(createUserMessage({
      content: [{ type: 'text', text: PROBE_TASK }],
      source: { kind: SOURCE_KIND, form: 'notice', summary: boundContextSummary(PROBE_TITLE) },
    }))
  } catch (error) {
    return { ok: false, step: 'followup', error: String(error), sessionId }
  }
  return { ok: true, sessionId, workspaceId: workspace?.id ?? null, agentPreset, renamed }
}
