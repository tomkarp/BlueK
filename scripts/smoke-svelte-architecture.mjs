import { access, readFile, readdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const entry = await read('frontend/src/entry.ts');
const main = await read('frontend/src/svelte-main.ts');
const app = await read('frontend/src/SvelteApp.svelte');
const components = await Promise.all((await readdir(new URL('frontend/src/components/', root)))
  .filter(name => name.endsWith('.svelte'))
  .map(async name => [name, await read(`frontend/src/components/${name}`)]));
const editorActions = await read('frontend/src/editorActions.ts');
const controllers = await Promise.all((await readdir(new URL('frontend/src/workspace/', root)))
  .filter(name => name.endsWith('.svelte.ts'))
  .map(async name => [name, await read(`frontend/src/workspace/${name}`)]));
const presentation = [app, editorActions, ...components.map(([, source]) => source), ...controllers.map(([, source]) => source)].join('\n');
const packageJson = JSON.parse(await read('package.json'));

if (!entry.includes("import './svelte-main'")) throw new Error('Svelte entry does not load SvelteApp.');
if (!main.includes("mount(App")) throw new Error('Svelte entry does not mount the application.');
for (const feature of ['LocalRuntimeClient', 'codemirror', 'waitingForInput', 'sendInput', 'sendEof', 'faulted', 'createDialog', 'invokeDialog', 'inspectorWindows', 'bluePlayAction', 'decorateStage', 'svelte-codepad-object-result', 'terminal-split-divider']) {
  if (!presentation.includes(feature)) throw new Error(`Svelte feature connection is missing: ${feature}`);
}
for (const [name, source] of components) {
  // Presentation components receive typed data/callbacks. UI controllers own
  // their domains, with one execution controller providing the runtime gateway.
  for (const forbidden of ['LocalRuntimeClient', 'RuntimeHost', 'new Worker(', 'getSnapshot(', 'runtimeWorker', 'createLocalRuntimeWorker']) {
    if (source.includes(forbidden)) throw new Error(`Runtime ownership escaped into ${name}: ${forbidden}`);
  }
}
if ((presentation.match(/new LocalRuntimeClient\(/g) || []).length !== 1) {
  throw new Error('The IDE must instantiate exactly one runtime client.');
}
for (const [name, source] of controllers) {
  if (name !== 'ExecutionWorkspace.svelte.ts' && /LocalRuntimeClient|createLocalRuntimeWorker|new Worker\(/.test(source)) {
    throw new Error(`Runtime creation escaped into ${name}.`);
  }
  if (/this\.host\.(?!ui\b)\w+\(\)\.\w+\s*=(?!=)/.test(source)) {
    throw new Error(`Controller ${name} writes another domain's state instead of requesting an action.`);
  }
}
for (const name of ['ProjectWorkspace', 'EditorWorkspace', 'ExecutionWorkspace', 'ObjectWorkspace', 'BluePlayWorkspace', 'TerminalWorkspace']) {
  if (!app.includes(`new ${name}(`)) throw new Error(`UI state owner is not connected: ${name}`);
}
for (const name of ['BluePlayWindow', 'EditorWindows', 'TerminalWindow', 'InspectorWindows', 'ClassDiagram', 'ObjectBenchCodepad', 'ProjectTransferDialogs']) {
  if (!app.includes(`./components/${name}.svelte`) || !new RegExp(`<${name}\\s`).test(app)) {
    throw new Error(`Presentation component is not connected: ${name}`);
  }
}
if (!packageJson.scripts['dev:svelte'] || !packageJson.scripts['build:svelte']) throw new Error('Svelte development/build scripts are missing.');
await access(new URL('frontend/src/SvelteApp.svelte', root));
console.log('Svelte architecture smoke test passed.');
