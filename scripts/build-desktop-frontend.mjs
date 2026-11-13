import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, [
  'node_modules/vite/bin/vite.js',
  'build',
  '--config',
  'frontend/vite.config.ts',
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_BASE_PATH: './',
    VITE_BLUEK_OFFLINE: '1',
    VITE_BLUEK_DESKTOP: '1',
  },
});
if (result.status !== 0) process.exit(result.status ?? 1);
