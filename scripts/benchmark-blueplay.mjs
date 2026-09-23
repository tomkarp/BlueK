import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

vm.runInThisContext(await readFile('frontend/public/kotlite/bluek-kotlite-browser.js', 'utf8'));
const project = JSON.parse(await readFile('frontend/public/examples/space-invaders.bluek.json', 'utf8'));
const complete = start => new Promise((resolve, reject) => {
  const accept = raw => {
    const value = JSON.parse(raw);
    if (value.kind === 'error') reject(new Error(value.display)); else resolve(value);
  };
  const started = start(() => reject(new Error('Unexpected input')), accept);
  if (JSON.parse(started).kind === 'error') accept(started);
});
for (const shooting of [false, true]) {
  const session = globalThis['bluek-kotlite-browser'].bluekCreateKotliteSession();
  session.configureBluePlay(true, 'benchmark');
  await complete((input, done) => session.startLoadProject(
    project.files.map(f => f.fileName),
    project.files.map(f => f.source.replaceAll('x - 5', 'x - 1').replaceAll('x + 5', 'x + 1')),
    'blueplay', 1, input, done));
  await complete((input, done) => session.startBluePlayMain(null, input, done));
  const initial = JSON.parse(session.takeStage()).stage;
  let previousInvaders = new Map(initial.objects.filter(object => object.className === 'Invader').map(object => [object.hitId, object.x]));
  session.setKey('right', true);
  session.setKey('space', shooting);
  const durations = [], renders = [];
  let previousFrame = 0, maxObjects = 0, previousX = 360;
  for (let i = 0; i < 180; i++) {
    session.setKey('right', i % 120 < 60);
    session.setKey('left', i % 120 >= 60);
    const start = performance.now();
    await complete((input, done) => session.startBluePlayStep(input, done));
    durations.push(performance.now() - start);
    const renderStart = performance.now();
    session.renderBluePlay();
    const frame = JSON.parse(session.takeStage()).stage;
    renders.push(performance.now() - renderStart);
    assert.ok(frame.frameVersion > previousFrame);
    previousFrame = frame.frameVersion;
    maxObjects = Math.max(maxObjects, frame.objects.length);
    const defender = frame.objects.find(object => object.className === 'Defender');
    assert.equal(defender.x, previousX + (i % 120 < 60 ? 1 : -1), 'held key must move exactly one pixel per complete step');
    previousX = defender.x;
    const invaders = frame.objects.filter(object => object.className === 'Invader');
    // Each invader turns around on its own, but all of them move in the same
    // complete step, never in partially rendered waves.
    for (const invader of invaders) {
      const previous = previousInvaders.get(invader.hitId);
      assert.equal(Math.abs(invader.x - previous), (i + 1) % 5 === 0 ? 8 : 0, 'invaders must move together, not in partially rendered waves');
    }
    previousInvaders = new Map(invaders.map(object => [object.hitId, object.x]));
  }
  if (shooting) assert.ok(maxObjects > 33, 'benchmark must actually create lasers');
  const stats = values => {
    const sorted = values.slice().sort((a, b) => a - b);
    return { mean: +(values.reduce((a,b) => a+b, 0)/values.length).toFixed(2), p95: +sorted[Math.floor(sorted.length*.95)].toFixed(2), max: +sorted.at(-1).toFixed(2) };
  };
  console.log(JSON.stringify({ shooting, steps: durations.length, maxObjects, stepMs: stats(durations), publicationMs: stats(renders) }));
}
