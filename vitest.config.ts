import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration-node',
          include: ['tests/integration/**/*.node.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration-edge',
          include: ['tests/integration/**/*.edge.test.ts'],
          environment: 'edge-runtime',
        },
      },
    ],
  },
})
