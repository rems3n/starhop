import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// base './' + HashRouter => the built site works from any path on any static host.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { host: '0.0.0.0' },
  test: { environment: 'node', include: ['tests/**/*.test.ts', 'src/**/*.test.ts'], testTimeout: 30000 },
});
