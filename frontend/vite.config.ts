import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { buildInfo } from './build/buildInfo.mjs';

export default defineConfig({
  root: path.resolve(process.cwd(), 'frontend'),
  base: process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? '/BlueK/' : '/'),
  plugins: [svelte()],
  define: { __BLUEK_BUILD_INFO__: JSON.stringify(buildInfo()) },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/feedback': {
        target: process.env.BLUEK_FEEDBACK_PROXY_TARGET || 'https://bluek.de',
        changeOrigin: true,
      },
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
