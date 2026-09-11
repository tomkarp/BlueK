import assert from 'node:assert/strict';
import {
  Actor,
  Image,
  World,
  bluekClick,
  bluekIsRunning,
  bluekKey,
  bluekStage,
  bluekStep,
  start,
  stop,
} from '../browser-runtime-js/bluek-browser-runtime.js';

class Figure extends Actor {
  constructor() {
    super();
    this.image = new Image(2, 2);
  }

  act() {
    if (globalThis.isKeyDown('right')) this.move(1);
  }
}

const world = new World(100, 30, 1);
world.show();
const figures = Array.from({ length: 50 }, (_, index) => {
  const figure = new Figure();
  world.addObject(figure, (index % 10) * 8 + 2, Math.floor(index / 10) * 5 + 2);
  return figure;
});

assert.equal(world.numberOfObjects, 50);
const before = figures[0].x;
bluekKey('right', true);
start();
bluekStep();
bluekKey('right', false);
stop();
assert.equal(figures[0].x, before + 1);
assert.equal(bluekIsRunning(), false);

bluekClick(figures[10].x, figures[10].y);
assert.equal(figures[10].isClicked, true);
assert.equal(figures[11].isClicked, false);

const first = figures[0];
const second = new Figure();
world.addObject(second, first.x, first.y);
assert.equal(first.intersects(second), true);
world.removeObject(second);
assert.equal(world.numberOfObjects, 50);

const background = new Image(100, 20);
background.setColor(20, 40, 60);
background.fillRect(0, 0, 100, 20);
background.drawString('BlueK', 2, 10);
world.background = background;
const stage = JSON.parse(bluekStage());
assert.equal(stage.objects.length, 50);
assert.ok(stage.backgroundOperations.length >= 2);
assert.equal(stage.objects[0].imageWidth, 2);

console.log('BlueK browser runtime smoke test passed');
