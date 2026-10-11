import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, request as forward } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { expect } from '@playwright/test';

// EXP-18/19: the production build below a prefix, the share-path SPA fallback
// and the real share service with a temporary database (no mocked replies).
const directory = await mkdtemp(path.join(tmpdir(), 'bluek-share-routing-'));
const sharePort = 18788;
const share = spawn(process.execPath, ['server/share-server.mjs'], {
  env: { ...process.env, BLUEK_SHARE_PORT: String(sharePort), BLUEK_SHARE_DB: path.join(directory, 'share.sqlite') },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const server = createServer();
const project = { format: 'bluek-project', version: 1, projectName: 'Shared program',
  files: [{ fileName: 'App.kt', kind: 'functions', source: 'fun main() { println("ready") }' }] };
const code = /^[a-z]{4,6}-[a-z]{4,6}-[a-z]{4,6}$/;
async function store(kind, payload) {
  const response = await fetch(`http://127.0.0.1:${sharePort}/api/${kind}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201);
  return (await response.json()).code;
}
try {
  const build = spawnSync('npm', ['run', 'build:svelte', '--', '--outDir', directory], {
    encoding: 'utf8', env: { ...process.env, VITE_BASE_PATH: '/BlueK/' },
  });
  assert.equal(build.status, 0, build.stderr);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await fetch(`http://127.0.0.1:${sharePort}/api/health`).then(r => r.ok, () => false)) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  server.on('request', async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      const proxied = forward({ host: '127.0.0.1', port: sharePort, path: request.url, method: request.method, headers: request.headers }, reply => {
        response.writeHead(reply.statusCode, reply.headers);
        reply.pipe(response);
      });
      return request.pipe(proxied);
    }
    // The deployment's SPA fallback serves new and transitional share paths.
    const file = path.resolve(directory, '.' + pathname.replace(/^\/BlueK/, ''));
    if (!pathname.startsWith('/BlueK/') || !file.startsWith(directory)) {
      response.writeHead(404); return response.end();
    }
    try {
      const target = pathname === '/BlueK/' || /^\/BlueK\/(bluek|run|load)\/[^/]+\/?$/i.test(pathname) ? path.join(directory, 'index.html') : file;
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
      response.setHeader('Content-Type', mime[path.extname(target)] ?? 'application/octet-stream');
      response.end(await readFile(target));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/BlueK/`;
  const program = { format: 'bluek-program', version: 1, mainFile: 'App.kt', blueKUrl: base, project };
  const runCode = await store('programs', program);
  const blockedCode = await store('programs', { ...program, allowBlueK: false });
  const projectCode = await store('projects', project);
  const full = base + '#run=p1.' + Buffer.from(JSON.stringify(program)).toString('base64url');
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ locale: 'en-US' });
      const requests = [];
      const errors = [];
      page.on('request', request => requests.push(request.url()));
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(full);
      await expect(page.locator('.player-terminal pre')).toHaveText('ready\n');
      assert.equal(requests.some(url => /svelte-main/.test(url)), false, 'Player must not preload IDE code or CSS');
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('bluek.project-draft.v1.'))), []);
      // Capitalized codes open like the lowercase code.
      await page.goto(base + 'run/' + runCode.toUpperCase());
      await expect(page.locator('.player-terminal pre')).toHaveText('ready\n');
      const developer = await page.getByRole('link', { name: 'Open in BlueK' }).getAttribute('href');
      assert.equal(developer, base + 'bluek/' + runCode);
      await page.evaluate(url => { window.location.href = url; }, developer);
      await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
      assert.equal(page.url(), base);
      await page.goto(base + 'bluek/' + projectCode);
      await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
      assert.equal(page.url(), base);
      await page.goto(base + 'load/' + projectCode);
      await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
      assert.equal(page.url(), base);

      // Unavailable codes explain themselves in the player and the IDE.
      await page.goto(base + 'run/abcd-efgh-ijkl');
      await expect(page.getByRole('alert')).toContainText('Program not found or expired.');
      await expect(page.getByRole('alert')).toContainText('Short links are kept for 30 days.');
      assert.equal(await page.getByRole('link', { name: 'Open BlueK' }).getAttribute('href'), base);
      await page.goto(base + 'run/' + projectCode);
      await expect(page.getByRole('alert')).toContainText('belongs to an editable BlueK project');
      assert.equal(await page.getByRole('link', { name: 'Open in BlueK' }).getAttribute('href'), base + 'bluek/' + projectCode);
      await page.goto(base + 'bluek/' + blockedCode);
      await expect(page.getByRole('alert')).toContainText('This program does not allow opening in BlueK.');
      assert.equal(page.url(), base);

      await page.goto(base + 'bluek/' + projectCode);
      await expect(page.getByLabel('Project name')).toHaveValue(project.projectName);
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: async value => { window.copied = value; },
        } });
      });
      const copied = async pattern => {
        await expect.poll(() => page.evaluate(() => window.copied)).toMatch(pattern);
        return page.evaluate(() => window.copied);
      };
      const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await page.getByRole('button', { name: 'Save / Export', exact: true }).click();
      let dialog = page.getByRole('dialog', { name: 'Save / Export', exact: true });
      await dialog.getByRole('button', { name: /^Copy Full Project Link/ }).click();
      await copied(new RegExp('^' + escaped + '#bluek='));
      await page.getByRole('button', { name: 'Save / Export', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Save / Export', exact: true });
      await dialog.getByRole('button', { name: /^Copy Short Link/ }).click();
      assert.match((await copied(new RegExp('^' + escaped + 'bluek/'))).slice(base.length + 6), code);
      await page.getByRole('dialog', { name: 'Short project link', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Save / Export', exact: true }).click();
      await dialog.getByRole('button', { name: 'Runnable program', exact: true }).click();
      await dialog.getByRole('button', { name: /^Copy Full Program Link/ }).click();
      await copied(new RegExp('^' + escaped + '#run='));
      await page.getByRole('button', { name: 'Save / Export', exact: true }).click();
      await dialog.getByRole('button', { name: /^Copy Short Program Link/ }).click();
      const shortProgram = await copied(new RegExp('^' + escaped + 'run/'));
      assert.match(shortProgram.slice(base.length + 4), code);
      await page.goto(shortProgram);
      await expect(page.locator('.player-terminal pre')).toHaveText('ready\n');
      assert.deepEqual(errors, []);
      console.log(`${engine.name()}: prefixed production player, developer navigation, all four share links and unavailable codes passed`);
    } finally { await browser.close(); }
  }
} finally {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  share.kill('SIGTERM');
  await rm(directory, { recursive: true, force: true });
}
