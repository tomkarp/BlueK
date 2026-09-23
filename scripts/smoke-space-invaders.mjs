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
  session.startBluePlayMain(null, onInput, onComplete)), 'Space Invaders main');

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
// The Defender fires by itself: the laser starts just above it.
const defender = afterShot.objects.find(object => object.className === 'Defender');
const laser = afterShot.objects.find(object => object.className === 'Laser');
if (!laser || laser.x !== defender.x || laser.y !== defender.y - 20) {
  throw new Error('The Defender did not create its laser above its own position.');
}

// Lasers remove hit invaders and themselves; invaders turn around individually.
expectOk(JSON.parse(session.setKey('space', true)), 'Space key held');
const directions = new Map();
let mixedDirections = false;
let previous = afterShot;
let maxLasers = 0;
for (let step = 0; step < 150; step += 1) {
  expectOk(await awaitCompletion((onInput, onComplete) =>
    session.startBluePlayStep(onInput, onComplete)), `Space Invaders step ${step}`);
  const frame = JSON.parse(session.takeStage()).stage;
  const before = new Map(previous.objects.filter(object => object.className === 'Invader').map(object => [object.hitId, object.x]));
  const moves = frame.objects.filter(object => object.className === 'Invader' && before.has(object.hitId))
    .map(object => Math.sign(object.x - before.get(object.hitId))).filter(Boolean);
  if (moves.includes(1) && moves.includes(-1)) mixedDirections = true;
  maxLasers = Math.max(maxLasers, frame.objects.filter(object => object.className === 'Laser').length);
  previous = frame;
}
expectOk(JSON.parse(session.setKey('space', false)), 'Space key released');
const remainingInvaders = previous.objects.filter(object => object.className === 'Invader').length;
if (remainingInvaders >= 32) throw new Error('No laser removed an invader.');
if (maxLasers > 6) throw new Error(`Lasers leaving the world were not removed (${maxLasers} at once).`);
if (!mixedDirections) throw new Error('Invaders did not turn around individually.');

// Forward references between project files do not depend on file order.
const alphabetical = project.files.slice().sort((a, b) => a.fileName.localeCompare(b.fileName));
const orderSession = api.bluekCreateKotliteSession();
orderSession.configureBluePlay(true, 'space-invaders-order');
expectOk(await awaitCompletion((onInput, onComplete) =>
  orderSession.startLoadProject(alphabetical.map(file => file.fileName), alphabetical.map(file => file.source), 'blueplay', 1, onInput, onComplete)),
  'Space Invaders load with Defender before Laser');

console.log('Space Invaders smoke passed.');
