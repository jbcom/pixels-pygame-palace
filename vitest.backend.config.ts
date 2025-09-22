import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage-backend',
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '*.config.ts',
        '*.config.js',
        'client/',
        '**/*.d.ts',
        'server/vite.ts', // Exclude vite setup from coverage
      ],
      include: [
        'apps/server/**/*.ts',
        'packages/shared/**/*.ts'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    },
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './packages/shared'),
      '@server': path.resolve(__dirname, './apps/server')
    }
  }
});