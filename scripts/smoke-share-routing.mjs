import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { expect } from '@playwright/test';

// Production static build + real separate-origin API (no proxy, no mocked
// authentication). The static host emulates Pages' legacy 404 fallback.
const directory = await mkdtemp(path.join(tmpdir(), 'bluek-share-routing-'));
const sharePort = 18788;
const staticPort = 18789;
const origin = `http://127.0.0.1:${staticPort}`;
const api = `http://127.0.0.1:${sharePort}`;
const databasePath = path.join(directory, 'private', 'share.sqlite');
const env = { ...process.env, BLUEK_SHARE_PORT: String(sharePort), BLUEK_SHARE_DB: databasePath, BLUEK_COOKIE_SECURE: '0', BLUEK_API_ORIGINS: origin, BLUEK_FEEDBACK_TOKEN: '', BLUEK_FEEDBACK_TOKEN_FILE: '' };
const share = spawn(process.execPath, ['server/share-server.mjs'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
let staticDirectory;
let prefix = '/';
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, origin).pathname;
  if (!pathname.startsWith(prefix)) { response.writeHead(404); response.end(); return; }
  const relative = decodeURIComponent(pathname.slice(prefix.length));
  let target = path.resolve(staticDirectory, relative || 'index.html');
  if (!target.startsWith(staticDirectory + path.sep) && target !== path.join(staticDirectory, 'index.html')) { response.writeHead(404); response.end(); return; }
  try {
    let content;
    try { content = await readFile(target); }
    catch {
      target = path.join(staticDirectory, 'index.html');
      content = await readFile(target);
      response.statusCode = 404;
    }
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json' })[path.extname(target)] || 'application/octet-stream');
    response.end(content);
  } catch { response.writeHead(500); response.end(); }
});
const project = { format: 'bluek-project', version: 1, projectName: 'Shared program', readme: '# Shared',
  files: [{ fileName: 'App.kt', kind: 'functions', source: 'fun main() { println("ready") }' }] };
async function store(kind, payload) {
  const response = await fetch(`${api}/api/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(response.status, 201);
  return (await response.json()).code;
}
const admin = (...args) => { const result = spawnSync(process.execPath, ['server/admin.mjs', ...args], { env, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); };
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await fetch(`${api}/api/health`).then(r => r.ok, () => false)) break;
    if (share.exitCode !== null) throw new Error('API startup failed.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  await new Promise(resolve => server.listen(staticPort, '127.0.0.1', resolve));
  for (const basePath of ['/', '/BlueK/']) {
    prefix = basePath;
    staticDirectory = path.join(directory, basePath === '/' ? 'root' : 'prefix');
    await mkdir(staticDirectory, { recursive: true });
    const build = spawnSync('npm', ['run', 'build:svelte', '--', '--outDir', staticDirectory], {
      encoding: 'utf8', env: { ...process.env, VITE_BASE_PATH: basePath, VITE_BLUEK_API_URL: api },
    });
    assert.equal(build.status, 0, build.stderr);
    const base = origin + basePath;
    const program = { format: 'bluek-program', version: 1, mainFile: 'App.kt', blueKUrl: base, project };
    const runCode = await store('programs', program);
    const hiddenCode = await store('programs', { ...program, allowBlueK: false, allowDownload: false, showProjectName: false });
    const projectCode = await store('projects', project);
    for (const engine of [chromium, webkit]) {
      const browser = await engine.launch();
      try {
        const context = await browser.newContext({ locale: 'en-US', acceptDownloads: true });
        const page = await context.newPage();
        const requests = [];
        const errors = [];
        page.on('request', request => requests.push(request.url()));
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base);
        await expect(page.getByLabel('Codepad input')).toBeEnabled();
        assert.equal(requests.some(url => url.startsWith(api)), false, 'No API dependency on editor startup');
        await page.goto(`${base}?run=${runCode.toUpperCase()}`);
        await expect(page.locator('.player-terminal pre')).toHaveText('ready\n');
        await expect(page.getByRole('link', { name: 'Open in BlueK' })).toHaveAttribute('href', `${base}?p=${runCode}`);
        await page.getByRole('link', { name: 'Open in BlueK' }).evaluate(link => { window.location.href = link.href; });
        await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
        await expect(page.getByRole('button', { name: /report inappropriate content/i })).toHaveCount(0);
        await page.goto(`${base}?p=${projectCode}&readme=1`);
        await expect(page.getByRole('dialog', { name: 'README.md' })).toBeVisible();
        await page.getByRole('dialog', { name: 'README.md' }).getByRole('button', { name: 'Close', exact: true }).click();
        // Existing path links work through a static 404 document, without rewrite.
        const legacy = await page.goto(`${base}bluek/${projectCode}`);
        assert.equal(legacy.status(), 404);
        await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
        await page.goto(`${base}load/${projectCode}`);
        await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
        const full = `${base}#run=p1.${Buffer.from(JSON.stringify(program)).toString('base64url')}`;
        await page.goto(full);
        await expect(page.locator('.player-terminal pre')).toHaveText('ready\n');
        await expect(page.getByRole('link', { name: 'Open in BlueK' })).toHaveAttribute('href', base);

        // Public player links do not expose a content-report action.
        await page.goto(`${base}?run=${hiddenCode}`);
        await expect(page.locator('.player-terminal pre')).toHaveText('ready\n');
        await expect(page.locator('.player-header')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /report inappropriate content/i })).toHaveCount(0);
        if (basePath === '/' && engine === chromium) {
          admin('block', hiddenCode);
          await page.reload();
          await expect(page.getByRole('alert')).toContainText('blocked by the operator');
          assert.equal((await fetch(`${api}/api/projects/${hiddenCode}`)).status, 451);
          admin('unblock', hiddenCode);
        }
        await page.goto(`${base}?run=${projectCode}`);
        await expect(page.getByRole('alert')).toContainText('belongs to an editable BlueK project');
        await page.goto(`${base}?run=aaaa-bbbb-cccc`);
        await expect(page.getByRole('alert')).toContainText('Publication not found.');

        await page.goto(`${base}?p=${projectCode}`);
        await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
        await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copied = value; } } }); });
        await page.getByRole('button', { name: 'Share', exact: true }).click();
        let dialog = page.getByRole('dialog', { name: 'Share', exact: true });
        await expect(dialog.getByRole('button', { name: /Full .* Link/ })).toHaveCount(0);
        await dialog.getByRole('button', { name: 'Create editing link', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Short project link', exact: true })).toBeVisible();
        const published = await page.evaluate(() => window.copied);
        const publishedUrl = new URL(published);
        assert.equal(publishedUrl.pathname, basePath);
        assert.match(publishedUrl.searchParams.get('p'), /^[a-z0-9]{12}$/);
        assert.equal(publishedUrl.hash, '');
        await page.getByRole('dialog', { name: 'Short project link', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
        await page.getByRole('button', { name: 'Share', exact: true }).click();
        await dialog.getByRole('button', { name: 'Create runnable link', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Short program link', exact: true })).toBeVisible();
        const playable = await page.evaluate(() => window.copied);
        assert.equal(new URL(playable).pathname, basePath);
        assert.match(new URL(playable).searchParams.get('run'), /^[a-z0-9]{12}$/);
        await page.getByRole('dialog', { name: 'Short program link', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();

        if (basePath === '/') {
          // Cross-origin cookie authentication with the real service, both engines.
          await page.getByRole('button', { name: 'Sign in', exact: true }).click();
          const cloud = page.getByRole('dialog', { name: 'Account', exact: true });
          await cloud.getByRole('button', { name: 'Create account', exact: true }).click();
          await expect(cloud).toContainText('there is no password reset', { ignoreCase: true });
          await cloud.getByLabel('Username (3–32 characters: a–z, 0–9, - or _)').fill(`browser_${engine.name()}`);
          await cloud.getByLabel('Password', { exact: true }).fill('browser-unique-password');
          await cloud.getByRole('checkbox').check();
          await cloud.getByRole('button', { name: 'Create account', exact: true }).last().click();
          await expect(cloud).toContainText(`Signed in as browser_${engine.name()}`);
          await cloud.getByRole('button', { name: 'Close', exact: true }).click();
          await page.getByRole('button', { name: 'Save', exact: true }).click();
          const saving = page.getByRole('dialog', { name: 'Save', exact: true });
          await saving.getByRole('button', { name: /^Save in account/ }).click();
          await saving.getByRole('button', { name: 'Save current project privately', exact: true }).click();
          await expect(saving.getByRole('status')).toContainText('saved privately');
          await expect(saving.getByRole('button', { name: 'Update this private project', exact: true })).toBeVisible();
          await saving.getByRole('button', { name: 'Cancel', exact: true }).click();
          await page.getByRole('button', { name: 'Account', exact: true }).click();
          await cloud.getByRole('button', { name: 'Change password', exact: true }).click();
          await cloud.getByLabel('Current password', { exact: true }).fill('browser-unique-password');
          await cloud.getByLabel('New password (12–128 characters)', { exact: true }).fill('changed-browser-password');
          await cloud.getByRole('button', { name: 'Change password', exact: true }).last().click();
          await expect(cloud.getByRole('status')).toContainText('Password changed');
          await cloud.getByRole('button', { name: 'Sign out', exact: true }).click();
          await expect(cloud.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(2);
          await cloud.getByLabel('Password', { exact: true }).fill('changed-browser-password');
          await cloud.getByRole('button', { name: 'Sign in', exact: true }).last().click();
          await expect(cloud).toContainText(`Signed in as browser_${engine.name()}`);
          await cloud.getByRole('button', { name: 'Close', exact: true }).click();
          await page.getByRole('button', { name: 'Open', exact: true }).click();
          const opening = page.getByRole('dialog', { name: 'Open', exact: true });
          await opening.locator('#open-source-account').click();
          await opening.locator('.cloud-project-open').click();
          await expect(opening).toBeHidden();
          await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
          await page.getByLabel('Project name').fill('Updated private project');
          await page.getByRole('button', { name: 'Save', exact: true }).click();
          await saving.getByRole('button', { name: /^Save in account/ }).click();
          await saving.getByRole('button', { name: 'Update this private project', exact: true }).click();
          await expect(saving.getByRole('status')).toContainText('saved privately');
          await saving.getByRole('button', { name: 'Cancel', exact: true }).click();
          await page.getByRole('button', { name: 'Open', exact: true }).click();
          await opening.locator('#open-source-account').click();
          await expect(opening.locator('.cloud-projects')).toContainText('Updated private project');
          page.once('dialog', dialog => dialog.accept());
          await opening.locator('.cloud-project-delete').click();
          await expect(opening).toContainText('No private projects saved yet.');
          await expect(page.getByLabel('Project name')).toHaveValue('Updated private project');
          await opening.getByRole('button', { name: 'Cancel', exact: true }).click();
          // API outage preserves the restored local editor and real Kotlin execution.
          await page.route(`${api}/**`, route => route.abort());
          await page.getByLabel('Project name').fill('Local work during outage');
          await page.reload();
          await expect(page.getByLabel('Project name')).toHaveValue('Local work during outage');
          await page.getByRole('button', { name: 'Compile', exact: true }).click();
          await page.getByRole('button', { name: 'Start main', exact: true }).click();
          await expect(page.locator('.terminal-output pre')).toHaveText('ready\n');
          await page.getByRole('button', { name: 'Sign in', exact: true }).click();
          await expect(cloud.getByRole('alert')).toContainText('server is unavailable');
          await expect(page.getByLabel('Project name')).toHaveValue('Local work during outage');
          await cloud.getByRole('button', { name: 'Close', exact: true }).click();
        }
        assert.deepEqual(errors, []);
        console.log(`${engine.name()} ${basePath}: real separate API, direct query/legacy links, player, publication/block${basePath === '/' ? ', cookie accounts/password change, private CRUD and API outage execution' : ''} passed`);
        await context.close();
      } finally { await browser.close(); }
    }
  }
} finally {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  if (share.exitCode === null) { const closed = new Promise(resolve => share.once('exit', resolve)); share.kill('SIGTERM'); await closed; }
  await rm(directory, { recursive: true, force: true });
}
