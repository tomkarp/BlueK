import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'frontend/src/windowInteraction.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const ui = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

const bounds = { left: 100, top: 80, width: 600, height: 400 };
const viewport = { width: 1000, height: 800 };
assert.deepEqual(ui.dragPosition(bounds, { left: 2000, top: 2000 }, viewport, 'visible'), { left: 780, top: 680 });
assert.deepEqual(ui.dragPosition(bounds, { left: 2000, top: 2000 }, viewport, 'contained'), { left: 392, top: 392 });
assert.deepEqual(ui.dragPosition(bounds, { left: -100, top: -100 }, viewport, 'minimum'), { left: 8, top: 8 });
assert.deepEqual(ui.dragPosition(bounds, { left: 2000, top: 2000 }, viewport, 'minimum'), { left: 2000, top: 2000 });
// North/west resizing reaches minimum size while the opposite edge stays put.
assert.deepEqual(ui.resizedFrame(bounds, 1000, 1000, 'nw'), {
  position: { left: 280, top: 220 }, size: { width: 420, height: 260 },
});
assert.deepEqual(ui.resizedFrame(bounds, 40, 30, 'se'), {
  position: { left: 100, top: 80 }, size: { width: 640, height: 430 },
});

// Pointer cancellation must release listeners: later movement cannot move a window.
const previousWindow = globalThis.window;
const surface = new EventTarget();
surface.innerWidth = viewport.width;
surface.innerHeight = viewport.height;
globalThis.window = surface;
try {
  const positions = [];
  let prevented = false;
  const event = {
    button: 0, clientX: 120, clientY: 100,
    target: { closest: () => null },
    currentTarget: { closest: () => ({ getBoundingClientRect: () => bounds }) },
    preventDefault: () => { prevented = true; },
  };
  ui.beginWindowDrag(event, '.editor-dialog', value => positions.push(value));
  assert.equal(prevented, true);
  const move = (x, y) => { const next = new Event('pointermove'); next.clientX = x; next.clientY = y; surface.dispatchEvent(next); };
  move(170, 160);
  assert.deepEqual(positions, [{ left: 150, top: 140 }]);
  surface.dispatchEvent(new Event('pointercancel'));
  move(500, 500);
  assert.equal(positions.length, 1);
  // A title-bar button does not start a drag.
  ui.beginWindowDrag({ ...event, target: { closest: () => ({}) } }, '.editor-dialog', value => positions.push(value));
  move(300, 300);
  assert.equal(positions.length, 1);
} finally { globalThis.window = previousWindow; }
console.log('Window interaction passed: viewport constraints, minimum resize, pointer cancellation and title-bar buttons.');
