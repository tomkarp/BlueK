import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildInfo } from './build/buildInfo.mjs';

const projectTemplateModule = 'virtual:bluek-project-templates';
const projectTemplatePlugin = {
  name: 'bluek-project-templates',
  resolveId(id: string) {
    if (id === projectTemplateModule) return `\0${projectTemplateModule}`;
  },
  load(id: string) {
    if (id !== `\0${projectTemplateModule}`) return;
    if (process.env.VITE_BLUEK_DESKTOP !== '1') return 'export default null;';
    const files = ['blueplay-empty.bluek', 'blueplay.bluek'];
    const templates = Object.fromEntries(files.map((file) => [
      file,
      JSON.parse(readFileSync(path.resolve(process.cwd(), 'frontend/public/examples', file), 'utf8')),
    ]));
    return `export default ${JSON.stringify(templates)};`;
  },
};

export default defineConfig({
  root: path.resolve(process.cwd(), 'frontend'),
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [svelte(), projectTemplatePlugin],
  define: { __BLUEK_BUILD_INFO__: JSON.stringify(buildInfo()) },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/feedback': {
        target: process.env.BLUEK_FEEDBACK_PROXY_TARGET || 'https://api.bluek.online',
        changeOrigin: true,
      },
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
