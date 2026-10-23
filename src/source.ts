import type { ContextFormed } from '@deepseek-ai/dsh-llm'

/** Message source kind for everything this plugin puts into a session inbox. */
export const SOURCE_KIND = 'dsh-threads'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'dsh-threads': { kind: 'dsh-threads' } & ContextFormed
  }
}
