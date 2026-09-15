import { access, readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const entry = await read('frontend/src/entry.ts');
const main = await read('frontend/src/svelte-main.ts');
const app = await read('frontend/src/SvelteApp.svelte');
const packageJson = JSON.parse(await read('package.json'));

if (!entry.includes("import './svelte-main'")) throw new Error('Svelte entry does not load SvelteApp.');
if (!main.includes("mount(App")) throw new Error('Svelte entry does not mount the application.');
for (const feature of ['LocalRuntimeClient', 'codemirror', 'waitingForInput', 'sendInput', 'sendEof', 'faulted', 'createDialog', 'invokeDialog', 'inspectorWindows', 'bluePlayAction', 'decorateStage', 'svelte-codepad-object-result', 'terminal-split-divider']) {
  if (!app.includes(feature)) throw new Error(`Svelte feature connection is missing: ${feature}`);
}
if (!packageJson.scripts['dev:svelte'] || !packageJson.scripts['build:svelte']) throw new Error('Svelte development/build scripts are missing.');
await access(new URL('frontend/src/SvelteApp.svelte', root));
console.log('Svelte architecture smoke test passed.');
