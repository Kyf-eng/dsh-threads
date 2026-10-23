// Adapts the real DSH services to ThreadHost (src/manager.ts). Verified against DSH
// 0.2.1-rc.2 in docs/IMPLEMENTATION.md §二 and the M0 spike table.
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { finalAssistantOutput } from '@deepseek-ai/dsh-subagent'
import { randomUUID } from 'node:crypto'
import type { ThreadAgent, ThreadHost } from './manager.ts'
import type { ProjectHost, WorkspaceInfo } from './projects.ts'
import { textOf } from './report.ts'
import { optional } from './services.ts'
import { SOURCE_KIND } from './source.ts'

interface SessionTitleLike {
  rename(session: Agent['session'], title: string): unknown
}

interface PermissionPresetsLike {
  current(session: Agent['session']): string
  set(session: Agent['session'], name: string): void
}

/** Every message this plugin puts into an inbox: tagged with our source, shown as a compact notice. */
export function noticeMessage(text: string, summary: string) {
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: SOURCE_KIND, form: 'notice', summary: boundContextSummary(summary) },
  })
}

export function wrapAgent(agent: Agent): ThreadAgent {
  return {
    id: agent.id,
    get status() { return agent.status },
    get seq() { return Number(agent.session.seq) },
    followup: (text, summary) => agent.followup(noticeMessage(text, summary)),
    inject: (text, summary) => agent.inject(noticeMessage(text, summary)),
  }
}

export function createHost(ctx: Context): ThreadHost & ProjectHost {
  const live = (sessionId: string): Agent | undefined => ctx.agents.get(sessionId as SessionId)

  const workspaceInfo = (workspace: { id: string; path: string } | undefined): WorkspaceInfo | undefined =>
    workspace === undefined ? undefined : { id: workspace.id, path: workspace.path }

  const rename = (sessionId: string, title: string) => {
    const agent = live(sessionId)
    if (agent !== undefined) optional<SessionTitleLike>(ctx, 'sessionTitle')?.rename(agent.session, title)
  }

  const resolveAgent = async (sessionId: string): Promise<Agent | undefined> => {
    const current = live(sessionId)
    if (current !== undefined) return current
    const resolved = await ctx.sessionController.resolveAgent(sessionId as SessionId)
    if ('error' in resolved) {
      ctx.logger.warn(`dsh-threads: cannot reach session ${sessionId}: ${resolved.error.message}`)
      return undefined
    }
    return resolved.agent
  }

  return {
    async createSession(mainSessionId, sessionId) {
      const workspace = ctx.workspaceRegistry.list().find((candidate) => candidate.sessionIds.includes(mainSessionId as SessionId))
      const created = await ctx.sessionController.create({
        ...(workspace === undefined ? {} : { workspaceId: workspace.id }),
        sessionId: sessionId as SessionId,
      })
      if (created.sessionId !== sessionId) throw new Error(`DSH reused session ${created.sessionId} instead of creating ${sessionId}`)
      const agent = await resolveAgent(sessionId)
      if (agent === undefined) throw new Error(`thread session ${sessionId} was created but cannot be resolved`)
      return wrapAgent(agent)
    },

    async resolve(sessionId) {
      const agent = await resolveAgent(sessionId)
      return agent === undefined ? undefined : wrapAgent(agent)
    },

    rename,

    async createMainSession(workspaceId, title) {
      const sessionId = `session-${randomUUID()}`
      const created = await ctx.sessionController.create({ workspaceId: workspaceId as never, sessionId: sessionId as SessionId })
      // A blank session has no live title yet until its agent is resolved.
      if (await resolveAgent(created.sessionId) !== undefined) rename(created.sessionId, title)
      return created.sessionId
    },

    workspace(workspaceId) {
      return workspaceInfo(ctx.workspaceRegistry.list().find((candidate) => candidate.id === workspaceId))
    },

    workspaceOf(sessionId) {
      return workspaceInfo(ctx.workspaceRegistry.list().find((candidate) => candidate.sessionIds.includes(sessionId as SessionId)))
    },

    inheritPermission(mainSessionId, threadId) {
      const presets = optional<PermissionPresetsLike>(ctx, 'permissionPresets')
      const main = live(mainSessionId)
      const thread = live(threadId)
      if (presets === undefined || main === undefined || thread === undefined) return
      presets.set(thread.session, presets.current(main.session))
    },

    roundOutput(threadId, fromSeq) {
      const agent = live(threadId)
      if (agent === undefined) return undefined
      const events = agent.session.snapshotEvents(fromSeq as Parameters<typeof agent.session.snapshotEvents>[0])
      return textOf(finalAssistantOutput(events) as { type: string; text?: string }[] | undefined)
    },
  }
}
