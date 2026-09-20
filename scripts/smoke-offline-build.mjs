// The offline bundle must run from a local folder without any internet access:
// build it, serve it with its own server and check what a browser would load.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repository = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const target = await mkdtemp(path.join(tmpdir(), 'bluek-offline-'));
const bundle = path.join(target, 'BlueK-offline');

try {
  const build = spawnSync('node', ['scripts/build-offline.mjs', '--out', target], { cwd: repository, encoding: 'utf8' });
  assert.equal(build.status, 0, `build:offline failed: ${build.stderr}`);

  for (const file of ['app/index.html', 'app/kotlite/bluek-kotlite-browser.js', 'server.mjs', 'server.ps1', 'start.bat', 'start.command', 'LIESMICH.txt']) {
    assert.ok(existsSync(path.join(bundle, file)), `missing in bundle: ${file}`);
  }

  // The ZIP is published for the download link, and must never contain itself.
  assert.ok(existsSync(path.join(repository, 'frontend/public/downloads/BlueK-offline.zip')), 'the ZIP must be published for the sidebar download link');
  assert.equal(existsSync(path.join(bundle, 'app/downloads')), false, 'the offline app must not carry a copy of the ZIP');

  // Nothing may be loaded from the internet, and relative asset paths keep the
  // bundle working from any folder.
  const index = await readFile(path.join(bundle, 'app/index.html'), 'utf8');
  assert.equal(index.match(/(src|href)="https?:\/\//g), null, 'index.html must not reference external URLs');
  assert.match(index, /src="\.\/assets\//, 'assets must be referenced relatively');
  const assets = await readdir(path.join(bundle, 'app/assets'));
  const main = await readFile(path.join(bundle, 'app/assets', assets.find(file => file.startsWith('index-') && file.endsWith('.js'))), 'utf8');
  assert.equal(main.includes('Copy Short Link'), false, 'the offline build must drop the share-server action');

  // The bundled server serves the app, refuses paths outside it and needs no network.
  const port = 8900 + Math.floor(Math.random() * 90);
  const server = spawn('node', [path.join(bundle, 'server.mjs'), String(port)], { stdio: 'ignore' });
  try {
    const get = async (url, attempt = 0) => {
      try {
        return await fetch(`http://127.0.0.1:${port}${url}`);
      } catch (error) {
        if (attempt > 40) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
        return get(url, attempt + 1);
      }
    };
    const page = await get('/');
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');

    const kotlite = await get('/kotlite/bluek-kotlite-browser.js');
    assert.equal(kotlite.status, 200);
    assert.equal(kotlite.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.ok((await kotlite.text()).includes('bluekCreateKotliteSession'), 'Kotlite bundle must be served');

    assert.equal((await get('/examples/blueplay.bluek.json')).status, 200);
    assert.equal((await get('/../server.mjs')).status, 404, 'paths outside the app folder must be refused');
    assert.equal((await get('/does-not-exist')).status, 404);
  } finally {
    server.kill();
  }

  console.log('Offline build smoke test passed.');
} finally {
  await rm(target, { recursive: true, force: true });
}
