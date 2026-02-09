import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        // Disable response buffering for SSE streams
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              // Prevent proxy from buffering SSE chunks
              proxyRes.headers['Cache-Control'] = 'no-cache';
              proxyRes.headers['X-Accel-Buffering'] = 'no';
            }
          });
        },
      },
    },
  },
});
