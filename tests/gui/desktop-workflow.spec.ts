import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  // Use the real Svelte app and Tauri SDK; native window creation is observed
  // through IPC rather than opening an OS window in the browser runner.
  await context.addInitScript(() => {
    const host = window as any;
    host.isTauri = true;
    localStorage.setItem('bluek-language', 'en');
    const callbacks = new Map<number, Function>();
    let id = 0;
    host.desktopWindows = [];
    const listeners: any[] = [];
    let pending = new URLSearchParams(location.search).has('bluekNativeStartup');
    host.desktopEmit = async (event: string, payload: unknown) => {
      for (const listener of listeners.filter(item => item.event === event))
        await callbacks.get(listener.handler)?.({ event, id: 1, payload });
    };
    host.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: new URLSearchParams(location.search).get('bluekWindow') ?? 'main' } },
      transformCallback(callback: Function) { callbacks.set(++id, callback); return id; },
      async invoke(command: string, args: any) {
        if (command === 'plugin:event|listen') { listeners.push(args); return ++id; }
        if (command === 'take_startup_project') {
          if (!pending) return null;
          pending = false;
          return '/tmp/finder.bluek';
        }
        if (command === 'read_project') return JSON.stringify({
          format: 'bluek-project', version: 1, projectName: 'From Finder',
          files: [{ fileName: 'Finder.kt', source: 'class Finder', kind: 'class' }],
        });
        if (command === 'plugin:webview|create_webview_window') {
          host.desktopWindows.push(args.options);
          return;
        }
        if (command === 'plugin:event|unlisten') return;
        throw new Error(`Unexpected desktop IPC: ${command}`);
      },
    };
    host.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
  });
});

test('Desktop workflow preserves the selected template across windows', async ({ context, page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: /^BluePlay Template/ }).click();
  await expect(page.getByRole('dialog', { name: 'Create New Project' })).toHaveCount(0);

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: /^BluePlay Example/ }).click();
  const destination = page.getByRole('dialog', { name: 'A project is already open' });
  await destination.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create New Project' })).toBeVisible();
  await page.getByRole('button', { name: /^BluePlay Example/ }).click();
  await destination.getByRole('button', { name: 'Open in new window', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create New Project' })).toHaveCount(0);
  const windows = await page.evaluate(() => (window as any).desktopWindows);
  expect(windows).toHaveLength(1);
  expect(new URL(windows[0].url, 'http://localhost').searchParams.get('bluekNewProject')).toBe('blueplay');

  const child = await context.newPage();
  await child.goto('/' + windows[0].url);
  await expect(child.getByRole('button', { name: 'Dog', exact: true })).toBeVisible();
  await expect(child.getByRole('dialog', { name: 'Create New Project' })).toHaveCount(0);
  await expect(child.getByRole('dialog', { name: 'A project is already open' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dog', exact: true })).toHaveCount(0);
});


test('Desktop consumes a file queued before frontend startup', async ({ page }) => {
  await page.goto('/?bluekNativeStartup=1');
  await expect(page.getByLabel('Project name')).toHaveValue('From Finder');
  await expect(page.getByRole('button', { name: 'Finder', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'A project is already open' })).toHaveCount(0);
});

test('Desktop file-open is handled by only its recipient window', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/?bluekWindow=other');
  for (const target of [page, other]) {
    await target.getByRole('button', { name: 'New', exact: true }).waitFor();
    await target.evaluate(async () => {
      await (window as any).desktopEmit('bluek://open-project', {
        path: '/tmp/finder.bluek', windowLabel: 'main',
      });
    });
  }
  await expect(page.getByLabel('Project name')).toHaveValue('From Finder');
  await expect(other.getByRole('button', { name: 'Finder', exact: true })).toHaveCount(0);
  await expect(other.getByRole('dialog', { name: 'A project is already open' })).toHaveCount(0);
});
