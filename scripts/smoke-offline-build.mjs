// Check the package, then exercise the IDE via file:// in real browsers.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = await mkdtemp(path.join(tmpdir(), 'bluek-offline-'));
const bundle = path.join(target, 'BlueK-offline');
try {
  const build = spawnSync('node', ['scripts/build-offline.mjs', '--out', target], { cwd: repository, encoding: 'utf8' });
  assert.equal(build.status, 0, `build:offline failed: ${build.stderr}`);
  assert.deepEqual((await readdir(bundle)).sort(), ['BlueK.html', 'LIESMICH.txt']);
  assert.ok(existsSync(path.join(repository, 'frontend/public/downloads/BlueK-offline.zip')));
  const html = await readFile(path.join(bundle, 'BlueK.html'), 'utf8');
  assert.equal(html.slice(0, html.indexOf("<script>")).match(/(?:src|href)="(?:https?:|\.\/assets\/)/g), null);
  assert.equal(html.includes('<script type="module"'), false);
  // Catalogs include all messages; offline link availability is checked in the live DOM.
  const zip = spawnSync('unzip', ['-Z1', path.join(target, 'BlueK-offline.zip')], { encoding: 'utf8' });
  assert.equal(zip.status, 0);
  assert.deepEqual(zip.stdout.trim().split('\n').sort(), [
    'BlueK-offline/', 'BlueK-offline/BlueK.html', 'BlueK-offline/LIESMICH.txt',
  ]);
  const gui = spawnSync('npx', ['playwright', 'test', '--config', 'playwright.offline.config.ts'], {
    cwd: repository, stdio: 'inherit', env: { ...process.env, BLUEK_OFFLINE_HTML: path.join(bundle, 'BlueK.html') },
  });
  assert.equal(gui.status, 0, 'Offline browser tests failed.');
  console.log('Offline single-file build and browser tests passed.');
} finally { await rm(target, { recursive: true, force: true }); }
