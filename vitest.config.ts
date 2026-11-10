import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The host half's text defaults to English until a browser says otherwise; most tests assert the Chinese text.
    setupFiles: ['tests/setup.ts'],
    // Worktrees inside the checkout carry their own copy of tests/: threads opened on this repo
    // (.agents/worktrees) and Claude Code sessions (.claude/worktrees). Run only this checkout's.
    exclude: [...configDefaults.exclude, '.agents/**', '.claude/**'],
  },
})
