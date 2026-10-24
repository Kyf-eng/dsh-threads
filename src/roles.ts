/** What dsh-threads installs into a session (src/install.ts). */
export type Role = 'dispatcher' | 'thread' | 'none'

export function roleOf(
  agent: { id: string; origin?: string },
  manager: { isProjectThread(id: string): boolean; isDispatcher(id: string): boolean },
): Role {
  // Subagent and Agent Team children are not conversations the user dispatches from.
  if (agent.origin === 'subagent') return 'none'
  if (manager.isProjectThread(agent.id)) return 'thread'
  if (manager.isDispatcher(agent.id)) return 'dispatcher'
  return 'none'
}
