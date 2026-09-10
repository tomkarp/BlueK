// Fixed BlueK browser implementation. Kotlin/JS student modules extend these
// JavaScript classes; the framework itself is not compiled from student files.
const state = { world: null, running: false, speed: 50, keys: new Set(), click: null, sounds: [] };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const color = (r, g, b) => `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;

export class Image {
  constructor(value, height) {
    this.fileName = typeof value === 'string' ? value : null;
    this.width = typeof value === 'number' ? Math.max(1, value) : 30;
    this.height = typeof value === 'number' ? Math.max(1, height) : 30;
    if (value instanceof Image) { this.fileName = value.fileName; this.width = value.width; this.height = value.height; }
    this.transparency = value instanceof Image ? value.transparency : 255;
    this._color = 'rgb(0, 0, 0)'; this._operations = [];
  }
  setColor(r, g, b) { this._color = color(r, g, b); }
  scale(width, height) { this.width = Math.max(1, width); this.height = Math.max(1, height); }
  _op(name, ...args) { this._operations.push([name, ...args, this._color].join('|')); }
  fill() { this.fillRect(0, 0, this.width, this.height); }
  fillRect(x, y, w, h) { this._op('fillRect', x, y, w, h); }
  drawRect(x, y, w, h) { this._op('drawRect', x, y, w, h); }
  fillOval(x, y, w, h) { this._op('fillOval', x, y, w, h); }
  drawOval(x, y, w, h) { this._op('drawOval', x, y, w, h); }
  drawLine(x1, y1, x2, y2) { this._op('drawLine', x1, y1, x2, y2); }
  drawString(text, x, y) { this._op('drawString', text, x, y); }
  drawImage(image, x, y) { this._operations.push(['drawImage', image.fileName || '', x, y].join('|')); }
  clear() { this._operations = []; }
  overlaps(other) { return true; }
}

export class Actor {
  constructor() { this.x = 0; this.y = 0; this.rotation = 0; this.image = null; this.__world = null; }
  act() {}
  get world() { if (!this.__world) throw new Error('The actor is not in a world.'); return this.__world; }
  get isAtEdge() { return this.__world ? this.x <= 0 || this.y <= 0 || this.x >= this.__world.width - 1 || this.y >= this.__world.height - 1 : false; }
  get isClicked() { return actorAt(state.click) === this && consumeClick(); }
  move(distance) { const radians = this.rotation * Math.PI / 180; this.x += Math.round(Math.cos(radians) * distance); this.y += Math.round(Math.sin(radians) * distance); this._clamp(); }
  turn(degrees) { this.rotation = ((this.rotation + degrees) % 360 + 360) % 360; }
  turnTowards(x, y) { if (x !== this.x || y !== this.y) this.rotation = Math.round(Math.atan2(y - this.y, x - this.x) * 180 / Math.PI); }
  distanceTo(other) { return Math.round(Math.hypot(other.x - this.x, other.y - this.y)); }
  intersects(other) { return Math.abs(this.x - other.x) <= 1 && Math.abs(this.y - other.y) <= 1; }
  getIntersecting() { return this.__world ? this.__world.allObjects().filter(actor => actor !== this && this.intersects(actor)) : []; }
  getOneIntersecting() { return this.getIntersecting()[0] || null; }
  isTouching() { return this.getIntersecting().length > 0; }
  removeTouching() { const actor = this.getOneIntersecting(); if (actor) this.world.removeObject(actor); }
  _clamp() { if (this.__world) { this.x = clamp(this.x, 0, this.__world.width - 1); this.y = clamp(this.y, 0, this.__world.height - 1); } }
}

export class World {
  constructor(width, height, cellSize) { this.width = width; this.height = height; this.cellSize = cellSize; this._actors = []; this._background = new Image(width * cellSize, height * cellSize); this._background.setColor(255, 255, 255); this._background.fill(); this._texts = new Map(); }
  act() {}
  show() { state.world = this; }
  get background() { return this._background; }
  set background(value) { this._background = value; }
  addObject(actor, x, y) { if (actor.__world && actor.__world !== this) actor.__world.removeObject(actor); actor.__world = this; if (!this._actors.includes(actor)) this._actors.push(actor); actor.x = x; actor.y = y; actor._clamp(); }
  removeObject(actor) { this._actors = this._actors.filter(item => item !== actor); if (actor.__world === this) actor.__world = null; }
  allObjects() { return [...this._actors]; }
  getObjects() { return [...this._actors]; }
  getObjectsAt(x, y) { return this._actors.filter(actor => actor.x === x && actor.y === y); }
  get numberOfObjects() { return this._actors.length; }
  setBackground(fileName) { this._background = new Image(fileName); this._background.scale(this.width * this.cellSize, this.height * this.cellSize); }
  setBackground(r, g, b) { this._background = new Image(this.width * this.cellSize, this.height * this.cellSize); this._background.setColor(r, g, b); this._background.fill(); }
  get isClicked() { return Boolean(state.click) && actorAt(state.click) === null && consumeClick(); }
  showText(text, x, y) { const key = `${x}:${y}`; if (text) this._texts.set(key, [x, y, text]); else this._texts.delete(key); }
}

export const isKeyDown = key => state.keys.has(String(key).toLowerCase());
export const playSound = fileName => state.sounds.push(String(fileName));
export const getSpeed = () => state.speed;
export const setSpeed = value => { state.speed = clamp(Number(value), 1, 100); };
export const start = () => { state.running = true; };
export const stop = () => { state.running = false; };
export const step = () => { if (!state.running) oneStep(); };
export const bluekRun = start;
export const bluekPause = stop;
export const bluekSetSpeed = setSpeed;
export const bluekAct = step;
export const bluekKey = (key, pressed) => pressed ? state.keys.add(String(key).toLowerCase()) : state.keys.delete(String(key).toLowerCase());
export const bluekClick = (x, y) => { state.click = { x, y }; };
const actorAt = point => state.world?.allObjects().slice().reverse().find(actor => { const image = actor.image; const radius = image ? Math.max(image.width, image.height) / 2 : 15; return point && Math.abs(actor.x * state.world.cellSize + state.world.cellSize / 2 - point.x) <= radius && Math.abs(actor.y * state.world.cellSize + state.world.cellSize / 2 - point.y) <= radius; });
const consumeClick = () => { if (!state.click) return false; state.click = null; return true; };
const oneStep = () => { if (!state.world) return; state.world.act(); state.world.allObjects().slice().forEach(actor => actor.act()); };
export const bluekStep = () => { if (state.running) oneStep(); };
export const bluekStage = () => JSON.stringify({ width: state.world?.width || 0, height: state.world?.height || 0, cellSize: state.world?.cellSize || 1, running: state.running, speed: state.speed, objects: state.world?.allObjects().map(actor => ({ type: actor.constructor.name || 'Actor', x: actor.x, y: actor.y, rotation: actor.rotation, imagePath: actor.image?.fileName || null, imageWidth: actor.image?.width || 30, imageHeight: actor.image?.height || 30 })) || [], texts: state.world ? [...state.world._texts.values()].map(([x, y, text]) => ({ x, y, text })) : [], backgroundColor: state.world?._background?._operations.at(-1)?.split('|').at(-1) || state.world?._background?._color || null, backgroundOperations: state.world?._background?._operations || [], sounds: state.sounds.splice(0) });
export const bluekStageJson = bluekStage;
export const bluekReadln = () => globalThis.__bluekReadln ? globalThis.__bluekReadln() : '';
export const bluekReadlnOrNull = () => globalThis.__bluekReadlnOrNull ? globalThis.__bluekReadlnOrNull() : null;
export const bluekStart = () => { if (typeof globalThis.main === 'function') globalThis.main(); };
globalThis.Actor = Actor; globalThis.World = World; globalThis.Image = Image;
Object.assign(globalThis, { isKeyDown, playSound, getSpeed, setSpeed, start, stop, step });
