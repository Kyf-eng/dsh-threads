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
