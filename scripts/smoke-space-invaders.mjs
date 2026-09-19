import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundle = await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8');
vm.runInThisContext(bundle, { filename: 'bluek-kotlite-browser.js' });
const api = globalThis['bluek-kotlite-browser'];
const project = JSON.parse(await readFile(new URL('../frontend/public/examples/space-invaders.bluek.json', import.meta.url), 'utf8'));
const session = api.bluekCreateKotliteSession();
session.configureBluePlay(true, 'space-invaders-smoke');

const expectOk = (value, label) => {
  if (value.kind === 'error') throw new Error(`${label}: ${value.display}`);
  return value;
};
const awaitCompletion = (start) => new Promise(resolve => {
  const started = JSON.parse(start(() => {}, value => resolve(JSON.parse(value))));
  if (started.kind === 'error') resolve(started);
});

const files = project.files.map(file => file.fileName);
const sources = project.files.map(file => file.source);
const loaded = await awaitCompletion((onInput, onComplete) =>
  session.startLoadProject(files, sources, 'blueplay', 1, onInput, onComplete));
expectOk(loaded, 'Space Invaders project load');
expectOk(await awaitCompletion((onInput, onComplete) =>
  session.startBluePlayMain(onInput, onComplete)), 'Space Invaders main');

const initial = JSON.parse(session.takeStage()).stage;
if (initial.width !== 720 || initial.height !== 480 || initial.objects.length !== 33) {
  throw new Error('Space Invaders did not create its world and 32 invaders plus defender.');
}

expectOk(JSON.parse(session.setKey('space', true)), 'Space key down');
const keyState = JSON.parse(session.evaluate('<Space Invaders smoke>', 'isKeyDown("space")'));
if (keyState.display !== 'true') throw new Error(`Space key state was not delivered: ${keyState.display}`);
expectOk(await awaitCompletion((onInput, onComplete) =>
  session.startBluePlayStep(onInput, onComplete)), 'Space Invaders first step');
expectOk(JSON.parse(session.setKey('space', false)), 'Space key up');
const afterShot = JSON.parse(session.takeStage()).stage;
if (afterShot.objects.length !== initial.objects.length + 1) {
  throw new Error('Space Invaders did not create a laser when Space was pressed.');
}

console.log('Space Invaders smoke passed.');
