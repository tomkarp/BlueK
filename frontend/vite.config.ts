import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(process.cwd(), 'frontend'),
  base: process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? '/BlueK/' : '/'),
  plugins: [svelte()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
