import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect, webkit, type Page } from '@playwright/test';

let html = process.env.BLUEK_OFFLINE_HTML;
let target: string | undefined;
test.beforeAll(async () => {
  if (html) return;
  target = await mkdtemp(path.join(tmpdir(), 'bluek-file-gui-'));
  const result = spawnSync('node', ['scripts/build-offline.mjs', '--out', target, '--no-zip'], { encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  html = path.join(target, 'BlueK-offline/BlueK.html');
});
test.afterAll(async () => { if (target) await rm(target, { recursive: true, force: true }); });

async function open(page: Page, source?: string, library?: boolean) {
  const failures: string[] = [];
  page.on('pageerror', error => { failures.push(error.message); });
  const requests: string[] = [];
  await page.context().route(/^https?:/, route => {
    requests.push(route.request().url());
    return route.abort();
  });
  const project = source ? '#bluek=p1.' + Buffer.from(JSON.stringify({
    format: 'bluek-project', version: 1, projectName: 'Lokal',
    files: [{ fileName: 'Main.kt', kind: 'functions', source }],
    ...(library ? { library: { id: 'blueplay', version: 1 } } : {}),
  })).toString('base64url') : '';
  await page.goto(pathToFileURL(html!).href + project);
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  if (source) await expect(page.getByLabel('Project name')).toHaveValue('Lokal');
  return () => { expect(requests).toEqual([]); expect(failures).toEqual([]); };
}
async function evaluate(page: Page, code: string) {
  const entries = page.locator('.codepad-entry');
  const count = await entries.count();
  await page.getByLabel('Codepad input').fill(code);
  await page.getByLabel('Codepad input').press('Enter');
  await expect(entries).toHaveCount(count + 1);
  await expect(entries.last().locator('.codepad-error')).toHaveCount(0);
  return entries.last();
}

test('GUI-62 file:// runs Kotlin, input, reset and restores/imports/exports projects without network', async ({ page }, info) => {
  const verify = await open(page, 'fun main() { println("lokal") }');
  expect(page.url()).toBe(pathToFileURL(html!).href); // Link cleanup must preserve the file path.
  await page.getByRole('button', { name: 'Compile', exact: true }).click();
  await page.getByRole('button', { name: 'Start main', exact: true }).click();
  await expect(page.locator('.terminal-output pre')).toHaveText('lokal\n');
  await expect(await evaluate(page, '1 + 2')).toContainText('3');
  await page.getByLabel('Codepad input').fill('println(readln())');
  await page.getByLabel('Codepad input').press('Enter');
  const input = page.getByPlaceholder('Enter a line; press Return');
  await expect(input).toBeVisible();
  await input.fill('Ada');
  await input.press('Enter');
  await expect(page.locator('.terminal-output pre')).toContainText('Ada');
  await page.getByRole('button', { name: 'Reset runtime', exact: true }).click();
  await expect(await evaluate(page, '2 + 3')).toContainText('5');
  await page.reload();
  await expect(page.getByLabel('Project name')).toHaveValue('Lokal');
  await page.getByRole('button', { name: 'Save / Export', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Copy Short Link/ })).toHaveCount(0);
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: /^Export Project JSON/ }).click(),
  ]);
  const file = info.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8')).files[0].source).toContain('println("lokal")');
  await page.getByRole('button', { name: 'Open / Import', exact: true }).click();
  await expect(page.getByLabel('Three-word project code')).toHaveCount(0);
  await page.getByLabel('Choose project file').setInputFiles(file);
  await expect(page.getByLabel('Project name')).toHaveValue('Lokal');
  verify();
});

test('GUI-62 all project templates are available locally; BluePlay renders standard images and steps', async ({ page }) => {
  const verify = await open(page);
  page.on('dialog', dialog => dialog.accept());
  for (const choice of ['BluePlay Template', 'BlueK Demo Project', 'Space Invaders Demo', 'BluePlay Example']) {
    await page.getByRole('button', { name: 'New Project', exact: true }).click();
    await page.getByRole('dialog', { name: 'Create New Project' }).getByRole('button', { name: new RegExp('^' + choice) }).click();
    await expect(page.getByRole('dialog', { name: 'Create New Project' })).toBeHidden();
    await expect(page.locator('.classcard').first()).toBeVisible();
  }
  await evaluate(page, 'main()');
  const stage = page.getByRole('dialog', { name: 'BluePlay – World' });
  await expect(stage).toBeVisible();
  await expect(stage.locator('canvas')).toBeVisible();
  await stage.getByRole('button', { name: 'Act once', exact: true }).click();
  await expect(page.getByLabel('Codepad input')).toBeEnabled();
  await evaluate(page, 'Image("apple.png").width');
  verify();
});

test('GUI-62 local formatter and HTML program export work from the single file', async ({ page }, info) => {
  const verify = await open(page, 'fun main(){println("exportiert")}');
  await page.locator('.classcard[aria-label="Main"]').dblclick();
  const editor = page.getByRole('dialog', { name: 'Editor: Main.kt', exact: true });
  await editor.getByRole('button', { name: 'Format Kotlin file' }).click();
  await expect(editor.locator('.cm-line')).toHaveCount(4);
  await expect(editor.locator('.cm-line').nth(1)).toHaveText('    println("exportiert")');
  await editor.getByRole('button', { name: 'Close editor' }).click();
  await page.getByRole('button', { name: 'Save / Export', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: /^Export as HTML/ }).click(),
  ]);
  const file = info.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const player = await page.context().newPage();
  await player.goto(pathToFileURL(file).href);
  await expect(player.getByRole('region', { name: 'Terminal' }).locator('pre')).toHaveText('exportiert\n');
  await expect(player.getByRole('link', { name: 'Open in BlueK' })).toHaveAttribute('href', /^https:\/\/bluek.de\/#bluek=/);
  verify();
});

test('GUI-62 WebKit also starts the single-file IDE and BluePlay worker', async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const verify = await open(page, 'fun main() { println("WebKit"); World(160, 80, 1).show() }', true);
    await page.getByRole('button', { name: 'Compile', exact: true }).click();
    await evaluate(page, 'main()');
    await expect(page.getByRole('dialog', { name: 'BluePlay – World' }).locator('canvas')).toBeVisible();
    await expect(page.locator('.terminal-output pre')).toHaveText('WebKit\n');
    verify();
  } finally { await browser.close(); }
});

test('GUI-129 user manual is bundled and readable without network', async ({ page }) => {
  const verify = await open(page);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const help = page.getByRole('dialog', { name: 'BlueK Help', exact: true });
  for (const section of ['Quick start', 'Saved state', 'Testing', 'Kotlin compatibility', 'BluePlay', 'Keyboard shortcuts']) {
    await help.getByRole('navigation', { name: 'Help sections' }).getByRole('button', { name: section, exact: true }).click();
    await expect(help.getByRole('heading', { name: section, exact: true })).toBeVisible();
  }
  await help.getByRole('button', { name: 'Close', exact: true }).click();
  verify();
});
