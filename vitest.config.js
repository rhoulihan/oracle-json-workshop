import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.js'],
          exclude: ['test/unit/frontend/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'frontend',
          include: ['test/unit/frontend/**/*.test.js'],
          environment: 'jsdom',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.js'],
          environment: 'node',
          testTimeout: 30000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js', 'src/index.js'],
    },
  },
});
