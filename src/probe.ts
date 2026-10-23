// M0 diagnostics: which host services this plugin can reach. Replaced by the real
// thread manager in M1; kept pure so it can be unit-tested without a DSH host.

/** Services the M1 design depends on (see docs/IMPLEMENTATION.md §二). */
export const PROBED_SERVICES = [
  'agents',
  'agentPresets',
  'commands',
  'connection',
  'permissionPresets',
  'sessionController',
  'sessionProjections',
  'sessionQuery',
  'sessions',
  'sessionTitle',
  'storageDomain',
  'systemPrompt',
  'userQuestions',
  'webServer',
  'workspaceRegistry',
  'worktrees',
] as const

/**
 * Read an optional service without declaring it in `inject`.
 * Cordis throws for a service that is not provided, so a miss becomes `undefined`.
 */
export function optional<T>(ctx: object, name: string): T | undefined {
  try {
    return (ctx as { get(name: string): unknown }).get(name) as T | undefined
  } catch {
    return undefined
  }
}

/** Map each service name to whether the host provides it. */
export function probeServices(get: (name: string) => unknown, names: readonly string[] = PROBED_SERVICES): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const name of names) {
    let value: unknown
    try {
      value = get(name)
    } catch {
      value = undefined
    }
    result[name] = value !== undefined && value !== null
  }
  return result
}
