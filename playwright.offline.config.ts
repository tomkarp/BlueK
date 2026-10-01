import { defineConfig } from '@playwright/test';

// Deliberately no webServer: these tests open only local HTML files.
export default defineConfig({
  testDir: './tests/gui',
  testMatch: 'offline.spec.ts',
  outputDir: './test-results-offline',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
  use: { viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
});
