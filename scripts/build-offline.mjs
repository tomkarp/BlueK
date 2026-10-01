// Build one HTML file that opens via file://, plus the downloadable ZIP.
// Usage: node scripts/build-offline.mjs [--out <dir>] [--no-zip] [--if-missing]
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gzipSync } from 'node:zlib';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { embeddedKotlite } from '../frontend/build/embeddedKotlite.mjs';
import { iife, inlineScript } from '../frontend/build/singleFile.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outIndex = process.argv.indexOf('--out');
const target = path.resolve(repository, outIndex === -1 ? 'dist-offline' : process.argv[outIndex + 1]);
const bundle = path.join(target, 'BlueK-offline');
const downloads = path.join(repository, 'frontend/public/downloads');
const withZip = !process.argv.includes('--no-zip');
if (process.argv.includes('--if-missing') && existsSync(path.join(downloads, 'BlueK-offline.zip'))) process.exit(0);

const playerBuild = spawnSync(process.execPath, ['scripts/build-player.mjs', '--if-missing'], {
  cwd: repository, stdio: 'inherit',
});
if (playerBuild.status !== 0) throw new Error('Could not build the HTML player template.');

// Use the player worker's existing embedded interpreter and RuntimeHost.
const worker = await iife('frontend/src/playerRuntimeWorker.ts', 'BlueKOfflineWorker', [embeddedKotlite()]);
const playerTemplate = await readFile(path.join(repository, 'frontend/public/player/bluek-player.html'), 'utf8');
// Gzip works natively in all supported browsers; no separate Brotli decoder.
const formatterGzipBase64 = gzipSync(brotliDecompressSync(await readFile(
  path.join(repository, 'node_modules/@scalar/kotlin-fmt/kotlin_fmt.wasm.br'),
)), { level: 9 }).toString('base64');
const projectTemplates = Object.fromEntries(await Promise.all([
  'blueplay-empty.bluek.json', 'blueplay.bluek.json', 'kotlin-example.bluek.json', 'space-invaders.bluek.json',
].map(async file => [file, JSON.parse(await readFile(path.join(repository, 'frontend/public/examples', file), 'utf8'))])));
const assetsId = '\0bluek-offline-assets';
const wasmId = '\0bluek-offline-unused-wasm-url';
const offline = {
  name: 'bluek-single-file-assets',
  enforce: 'pre',
  resolveId(id, importer) {
    if (id === 'virtual:bluek-player-worker') return '\0' + id;
    if (id === '@scalar/kotlin-fmt/wasm?url') return wasmId;
    if (importer && id.startsWith('.')) {
      const resolved = path.resolve(path.dirname(importer), id).replace(/\.ts$/, '');
      if (resolved === path.join(repository, 'frontend/src/offlineAssets')) return assetsId;
      if (resolved === path.join(repository, 'frontend/src/localRuntimeWorkerFactory'))
        return path.join(repository, 'frontend/src/offlineRuntimeWorkerFactory.ts');
    }
  },
  load(id) {
    if (id === '\0virtual:bluek-player-worker') return `export default ${JSON.stringify(worker)};`;
    if (id === assetsId) return `export default ${JSON.stringify({ playerTemplate, formatterGzipBase64, projectTemplates })};`;
    if (id === wasmId) return 'export default "";';
  },
  config() {
    return { define: {
      'import.meta.env.VITE_BLUEK_OFFLINE': JSON.stringify('1'),
      'import.meta.env.BASE_URL': JSON.stringify('./'),
    } };
  },
};
const app = await iife('frontend/src/offlineMain.ts', 'BlueKOffline', [offline, svelte({ emitCss: false })]);
const css = await readFile(path.join(repository, 'frontend/src/style.css'), 'utf8');
if (/<\/style/i.test(css)) throw new Error('CSS cannot be inlined safely.');
const html = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BlueK</title>
<style>${css}</style></head>
<body><div id="root"></div><script>${inlineScript(app)}</script></body>
</html>\n`;
await rm(target, { recursive: true, force: true });
await mkdir(bundle, { recursive: true });
await writeFile(path.join(bundle, 'BlueK.html'), html);
await cp(path.join(repository, 'scripts/offline/LIESMICH.txt'), path.join(bundle, 'LIESMICH.txt'));
if (withZip) {
  const zip = spawnSync('zip', ['-r', '-q', 'BlueK-offline.zip', 'BlueK-offline'], { cwd: target, stdio: 'inherit' });
  if (zip.status !== 0) throw new Error('Could not create offline ZIP.');
  await mkdir(downloads, { recursive: true });
  await cp(path.join(target, 'BlueK-offline.zip'), path.join(downloads, 'BlueK-offline.zip'));
}
console.log(`Offline BlueK: ${path.join(bundle, 'BlueK.html')} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
console.log('Start: BlueK.html doppelklicken. Kein Server erforderlich.');
