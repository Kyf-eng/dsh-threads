/** In-memory M0 diagnostics shared by the probe tool, the RPC channel and event listeners. */
export interface ProbeState {
  readonly plugin: { name: string; version: string }
  readonly loadedAt: string
  rpcRegistered: boolean
  /** Why the panel route could not be registered, if it failed. */
  rpcError: string | null
  rpcPings: number
  agentCreated: number
  /** Last few `agent/created` events: session id and start source. */
  recentCreated: { id: string; source: unknown }[]
  /** Probe sessions opened by `thread_status { spawn: true }`, with their last status. */
  probeSessions: Map<string, string>
}

export function createProbeState(plugin: { name: string; version: string }): ProbeState {
  return {
    plugin,
    loadedAt: new Date().toISOString(),
    rpcRegistered: false,
    rpcError: null,
    rpcPings: 0,
    agentCreated: 0,
    recentCreated: [],
    probeSessions: new Map(),
  }
}
