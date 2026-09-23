import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

// The shared BluePlay frame logic used by the IDE canvas and the exported player.
const bundle = await rolldown({ input: 'frontend/src/bluePlayStage.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { StageRenderer, decorateStage, resourceData, stageKeyName, stageStyle } =
  await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

assert.equal(stageKeyName('ArrowLeft'), 'left');
assert.equal(stageKeyName('ArrowDown'), 'down');
assert.equal(stageKeyName(' '), 'space');
assert.equal(stageKeyName('A'), 'a');
assert.equal(stageKeyName('Enter'), 'enter');

assert.equal(
  stageStyle({ width: 10, height: 5, cellSize: 20, backgroundColor: '#123' }),
  '--bluek-world-width:200px;--bluek-world-height:100px;aspect-ratio:200/100;background-color:#123',
);

const resources = [
  { path: 'images/rocket.png', data: 'data:image/png;base64,ROCKET' },
  { path: 'sounds/pop.wav', data: 'data:audio/wav;base64,POP' },
];
assert.equal(resourceData(resources, 'sounds/pop.wav'), 'data:audio/wav;base64,POP');
assert.equal(resourceData(resources, 'sounds/missing.wav'), undefined);

const stage = {
  frameVersion: 1, width: 10, height: 10, cellSize: 10, backgroundColor: '#fff',
  objects: [
    { hitId: 'rocket', className: 'Rocket', x: 2, y: 2, rotation: 0,
      image: { resourcePath: 'rocket.png', width: 30, height: 30, opacity: 1 } },
    { objectId: 'box', className: 'Box', x: 7, y: 7, rotation: 45, image: { width: 20, height: 4, opacity: 1 } },
    { objectId: 'ghost', className: 'Ghost', x: 5, y: 5, rotation: 0, image: { width: 20, height: 20, opacity: 0.05 } },
  ],
  texts: [], speed: 50, simulation: 'paused',
};
const decorated = decorateStage(stage, resources, { 'images/rocket.png': { width: 16, height: 12 } });
assert.equal(decorated.objects[0].imageData, 'data:image/png;base64,ROCKET', 'Resource image resolves to its data');
assert.deepEqual([decorated.objects[0].imageWidth, decorated.objects[0].imageHeight], [16, 12], 'Measured size wins');
assert.match(decorated.objects[1].imageData, /^data:image\/svg\+xml/, 'An actor without image gets an empty drawing');
assert.equal(decorated.objects[1].imageWidth, 20);

// Without image data the actor's rotated bounds decide; decoding images needs a browser.
const renderer = new StageRenderer(() => undefined);
const frame = { ...stage, objects: stage.objects.slice(1) };
const bounds = { left: 100, top: 50, width: 200, height: 200 }; // world is drawn at twice its size
// The box centre is at world pixel (75, 75); rotated by 45 degrees its long axis is diagonal.
assert.deepEqual(renderer.pointer(frame, bounds, 100 + 150, 50 + 150), { x: 7, y: 7, actorId: 'box' });
assert.deepEqual(renderer.pointer(frame, bounds, 100 + 2 * 81, 50 + 2 * 81), { x: 8, y: 8, actorId: 'box' }, 'Rotated extent is hit');
assert.deepEqual(renderer.pointer(frame, bounds, 100 + 2 * 81, 50 + 2 * 69), { x: 8, y: 6, actorId: undefined }, 'Outside the rotated box');
assert.deepEqual(renderer.pointer(frame, bounds, 100 + 110, 50 + 110), { x: 5, y: 5, actorId: undefined }, 'Almost transparent actors are not targets');
assert.deepEqual(renderer.pointer(frame, bounds, 90, 40), { x: 0, y: 0, actorId: undefined }, 'Positions clamp to the world');
assert.deepEqual(renderer.pointer(frame, bounds, 400, 400), { x: 9, y: 9, actorId: undefined });

console.log('BluePlay stage smoke passed.');
