import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { build } from 'vite';
import { embeddedKotlite } from '../frontend/build/embeddedKotlite.mjs';

/**
 * Builds the exported player as one self-contained HTML template
 * (`frontend/public/player/bluek-player.html`): player code, runtime worker and
 * gzip-compressed Kotlite inline, plus the empty program element the IDE fills
 * on export. The file needs no server and makes no network request.
 */
const repository = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const output = path.join(repository, 'frontend/public/player/bluek-player.html');
const kotlite = path.join(repository, 'frontend/public/kotlite/bluek-kotlite-browser.js');

if (process.argv.includes('--if-missing')) {
  const [template, bundle] = await Promise.all([stat(output).catch(() => null), stat(kotlite)]);
  if (template && template.mtimeMs >= bundle.mtimeMs) process.exit(0);
}

async function iife(entry, name, plugins) {
  const [result] = await build({
    configFile: false,
    root: repository,
    logLevel: 'warn',
    plugins,
    build: {
      write: false,
      minify: true,
      target: 'es2022',
      lib: { entry: path.join(repository, entry), name, formats: ['iife'], fileName: name },
    },
  });
  const chunks = result.output.filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || result.output.length !== 1)
    throw new Error(`${entry} must build to a single script, got ${result.output.map(item => item.fileName).join(', ')}.`);
  return chunks[0].code;
}

function inlineScript(code) {
  // Inside <script>, only these sequences can end the element or change how
  // the HTML parser reads it; in minified code they occur in strings/regexes.
  const escaped = code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  if (/<\/script|<!--/i.test(escaped)) throw new Error('Script cannot be inlined safely.');
  return escaped;
}

const workerSource = await iife('frontend/src/playerRuntimeWorker.ts', 'BlueKPlayerWorker', [embeddedKotlite(kotlite)]);
const playerWorker = {
  name: 'bluek-player-worker',
  resolveId: id => (id === 'virtual:bluek-player-worker' ? '\0virtual:bluek-player-worker' : undefined),
  load: id => (id === '\0virtual:bluek-player-worker' ? `export default ${JSON.stringify(workerSource)};` : undefined),
};
const playerSource = await iife('frontend/src/playerMain.ts', 'BlueKPlayer', [svelte({ emitCss: false }), playerWorker]);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="BlueK">
<title>BlueK program</title>
</head>
<body>
<div id="app"></div>
<script type="application/json" id="bluek-program"></script>
<script>${inlineScript(playerSource)}</script>
</body>
</html>
`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`BlueK player template: ${path.relative(repository, output)} (${Math.round(html.length / 1024)} KB)`);
