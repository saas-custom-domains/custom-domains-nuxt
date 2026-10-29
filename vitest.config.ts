import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    // The integration tests build the app once, which takes a while.
    hookTimeout: 240_000,
    setupFiles: ['tests/setup.ts'],
    env: {
      APP_HOSTS: 'localhost,127.0.0.1,shopfront.app',
      APP_DOMAIN: 'shopfront.app',
      PROXY_AUTH_TOKEN: 'test_token',
    },
  },
})
