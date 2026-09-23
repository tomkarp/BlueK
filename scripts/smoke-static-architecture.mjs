import { access, readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const runtimeSources = [
  ['frontend/src/localRuntimeClient.ts', await read('frontend/src/localRuntimeClient.ts')],
  ['frontend/src/localRuntimeWorker.ts', await read('frontend/src/localRuntimeWorker.ts')],
  ['frontend/src/localRuntimeWorkerFactory.ts', await read('frontend/src/localRuntimeWorkerFactory.ts')],
  ['frontend/src/runtimeWorker.ts', await read('frontend/src/runtimeWorker.ts')],
  ['frontend/src/playerRuntimeWorker.ts', await read('frontend/src/playerRuntimeWorker.ts')],
  ['frontend/src/embeddedKotlite.ts', await read('frontend/src/embeddedKotlite.ts')],
  ['frontend/src/SvelteApp.svelte', await read('frontend/src/SvelteApp.svelte')],
];

const forbidden = [
  ['HttpRuntimeClient', 'HTTP runtime client'],
  ['WebSocket', 'WebSocket transport'],
  ['XMLHttpRequest', 'XHR transport'],
  ['ws://', 'WebSocket URL'],
  ['wss://', 'secure WebSocket URL'],
  ['fetch("http', 'external HTTP runtime fetch'],
  ["fetch('http", 'external HTTP runtime fetch'],
  ['/api/', 'application-server API path'],
];

for (const [fileName, source] of runtimeSources) {
  for (const [needle, description] of forbidden) {
    if (source.includes(needle)) {
      throw new Error(`${description} found in ${fileName}.`);
    }
  }
}

const worker = runtimeSources.find(([fileName]) => fileName.endsWith('localRuntimeWorker.ts'))[1];
if (!worker.includes("new URL('../kotlite/bluek-kotlite-browser.js', import.meta.url)")) {
  throw new Error('The browser worker does not point at the bundled Kotlite asset.');
}
if (!worker.includes('fetch(bundleUrl)')) {
  throw new Error('The browser worker does not load its bundled static asset.');
}
const playerWorker = runtimeSources.find(([fileName]) => fileName.endsWith('playerRuntimeWorker.ts'))[1];
if (!playerWorker.includes("from 'virtual:bluek-kotlite-gzip'") || playerWorker.includes('fetch(')) {
  throw new Error('The player worker must use the embedded Kotlite bundle and never fetch it.');
}

await access(new URL('frontend/public/kotlite/bluek-kotlite-browser.js', root));
await access(new URL('frontend/dist/kotlite/bluek-kotlite-browser.js', root));
const distIndex = await read('frontend/dist/index.html');
if (/(?:src|href)=["']https?:\/\//i.test(distIndex)) {
  throw new Error('The production HTML contains an external runtime asset.');
}
if (!distIndex.includes('/assets/')) {
  throw new Error('The production HTML does not reference local bundled assets.');
}

const packageJson = JSON.parse(await read('package.json'));
if (Object.keys(packageJson.dependencies || {}).some(name => /express|koa|fastify|ws|socket\.io|axios/i.test(name))) {
  throw new Error('A backend/runtime transport dependency is still declared.');
}

console.log('Static browser architecture smoke test passed.');
