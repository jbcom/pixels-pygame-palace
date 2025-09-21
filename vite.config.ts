import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) => m.cartographer()),
          await import('@replit/vite-plugin-dev-banner').then((m) => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true, // Important for Replit
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
    proxy: {
      // Proxy Socket.IO connections to Flask
      '/socket.io': {
        target: 'ws://localhost:5001',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      // Proxy Flask API endpoints
      '/api/compile': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/api/execute': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/api/game-stream': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/api/projects': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      // Or if you prefer, proxy all /api/* to Flask
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        configure: (proxy, options) => {
          // SSE support for game streaming
          proxy.on('proxyReq', (proxyReq, req, res) => {
            if (req.url?.includes('/game-stream')) {
              proxyReq.setHeader('Cache-Control', 'no-cache');
              proxyReq.setHeader('Connection', 'keep-alive');
            }
          });
        },
      },
    },
  },
});
