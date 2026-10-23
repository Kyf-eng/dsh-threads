// M0 placeholder for thread_status: reports what the plugin can reach so the
// docs/IMPLEMENTATION.md spikes can be answered from inside a real session.
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { probeServices } from '../probe.ts'
import { spawnProbe } from '../spike.ts'
import type { ProbeState } from '../state.ts'

export function registerThreadStatusTool(ctx: Context, state: ProbeState): () => void {
  return ctx.tools.register(defineTool({
    name: 'thread_status',
    description: 'dsh-threads (M0 probe): report whether the dsh-threads plugin is loaded and which DSH services it can reach. '
      + 'Set spawn to true only when the user explicitly asks to test opening a thread session; it creates one real session.',
    parameters: {
      spawn: {
        type: 'boolean',
        description: 'Create one probe session through the same path real threads will use.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const spawn = args.spawn === true && exec.agent !== undefined
        ? await spawnProbe(ctx, exec.agent)
        : undefined
      if (spawn?.ok === true) state.probeSessions.set(spawn.sessionId, 'starting')
      const report = {
        plugin: state.plugin,
        loadedAt: state.loadedAt,
        caller: exec.agent?.id ?? null,
        services: probeServices((name) => (ctx as unknown as { get(name: string): unknown }).get(name)),
        rpcRegistered: state.rpcRegistered,
        rpcError: state.rpcError,
        rpcPings: state.rpcPings,
        agentCreated: { count: state.agentCreated, recent: state.recentCreated },
        probeSessions: Object.fromEntries(state.probeSessions),
        ...(spawn === undefined ? {} : { spawn }),
      }
      return JSON.stringify(report, null, 2)
    },
  }))
}
