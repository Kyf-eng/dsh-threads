import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The host half's text defaults to English until a browser says otherwise; most tests assert the Chinese text.
    setupFiles: ['tests/setup.ts'],
  },
})
