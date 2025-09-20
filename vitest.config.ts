import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', '*.config.ts']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@/components': path.resolve(__dirname, './client/src/components'),
      '@/lib': path.resolve(__dirname, './client/src/lib'),
      '@/hooks': path.resolve(__dirname, './client/src/hooks'),
      '@assets': path.resolve(__dirname, './attached_assets')
    }
  }
});