import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Set test timeout to prevent hanging tests
    testTimeout: 10000,
    hookTimeout: 10000,
    // Exclude integration tests from default test run when collecting coverage
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Exclude integration tests from coverage runs
      process.env.COVERAGE === 'true' ? '**/tests/integration/**' : '',
      // Exclude e2e tests
      '**/tests/e2e/**',
      '**/*.e2e.test.{ts,tsx}',
      '**/*.integration.test.{ts,tsx}'
    ].filter(Boolean),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/', 
        'tests/',
        '*.config.ts',
        '*.config.js',
        'server/',
        '**/index.ts',
        '**/*.d.ts',
        // Explicitly exclude integration and e2e tests from coverage
        '**/tests/integration/**',
        '**/tests/e2e/**',
        '**/*.integration.test.{ts,tsx}',
        '**/*.e2e.test.{ts,tsx}'
      ],
      include: [
        'client/src/**/*.{ts,tsx}'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    },
    // Run tests in parallel for better performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@/components': path.resolve(__dirname, './client/src/components'),
      '@/lib': path.resolve(__dirname, './client/src/lib'),
      '@/hooks': path.resolve(__dirname, './client/src/hooks'),
      '@/pages': path.resolve(__dirname, './client/src/pages'),
      '@assets': path.resolve(__dirname, './attached_assets')
    }
  },
  esbuild: {
    jsx: 'automatic'
  }
});