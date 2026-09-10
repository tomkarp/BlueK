// Fixed JavaScript BluePlay runtime. Function constructors are intentional:
// Kotlin/JS ES5 output calls base constructors with Base.call(this, ...).
const state = { world: null, running: false, speed: 50, keys: new Set(), click: null, sounds: [] };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const color = (r, g, b) => `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;

export function Image(value, height) {
  this.fileName = typeof value === 'string' ? value : null;
  this.width = typeof value === 'number' ? Math.max(1, value) : 30;
  this.height = typeof value === 'number' ? Math.max(1, height) : 30;
  if (value instanceof Image) { this.fileName = value.fileName; this.width = value.width; this.height = value.height; }
  this.transparency = value instanceof Image ? value.transparency : 255;
  this._color = 'rgb(0, 0, 0)'; this._operations = [];
}
Image.prototype.setColor = function(r, g, b) { this._color = color(r, g, b); };
Image.prototype.scale = function(width, height) { this.width = Math.max(1, width); this.height = Math.max(1, height); };
Image.prototype.setTransparency = function(value) { this.transparency = clamp(value, 0, 255); };
Image.prototype._op = function(name, ...args) { this._operations.push([name, ...args, this._color].join('|')); };
Image.prototype.fill = function() { this.fillRect(0, 0, this.width, this.height); };
Image.prototype.fillRect = function(x, y, w, h) { this._op('fillRect', x, y, w, h); };
Image.prototype.drawRect = function(x, y, w, h) { this._op('drawRect', x, y, w, h); };
Image.prototype.fillOval = function(x, y, w, h) { this._op('fillOval', x, y, w, h); };
Image.prototype.drawOval = function(x, y, w, h) { this._op('drawOval', x, y, w, h); };
Image.prototype.drawLine = function(x1, y1, x2, y2) { this._op('drawLine', x1, y1, x2, y2); };
Image.prototype.drawString = function(text, x, y) { this._op('drawString', text, x, y); };
Image.prototype.drawImage = function(image, x, y) { this._operations.push(['drawImage', image.fileName || '', x, y, image.width, image.height].join('|')); };
Image.prototype.clear = function() { this._operations = []; };
Image.prototype.overlaps = function(other) { return Boolean(other); };
Object.defineProperties(Image.prototype, { drawOperations: { get() { return [...this._operations]; } }, backgroundColor: { get() { return this._operations.at(-1)?.split('|').at(-1) || this._color; } } });

export function Actor() { this.x = 0; this.y = 0; this.rotation = 0; this.image = null; this.__world = null; }
Actor.prototype.act = function() {};
Object.defineProperties(Actor.prototype, {
  world: { get() { if (!this.__world) throw new Error('The actor is not in a world.'); return this.__world; } },
  isAtEdge: { get() { return this.__world ? this.x <= 0 || this.y <= 0 || this.x >= this.__world.width - 1 || this.y >= this.__world.height - 1 : false; } },
  isClicked: { get() { return actorAt(state.click) === this && consumeClick(); } }
});
Actor.prototype.move = function(distance) { const radians = this.rotation * Math.PI / 180; this.x += Math.round(Math.cos(radians) * distance); this.y += Math.round(Math.sin(radians) * distance); this._clamp(); };
Actor.prototype.turn = function(degrees) { this.rotation = ((this.rotation + degrees) % 360 + 360) % 360; };
Actor.prototype.turnTowards = function(x, y) { if (x !== this.x || y !== this.y) this.rotation = Math.round(Math.atan2(y - this.y, x - this.x) * 180 / Math.PI); };
Actor.prototype.distanceTo = function(other) { return Math.round(Math.hypot(other.x - this.x, other.y - this.y)); };
Actor.prototype.intersects = function(other) { return Math.abs(this.x - other.x) * 2 <= ((this.image?.width || 30) + (other.image?.width || 30)) / Math.max(1, this.__world?.cellSize || 1) && Math.abs(this.y - other.y) * 2 <= ((this.image?.height || 30) + (other.image?.height || 30)) / Math.max(1, this.__world?.cellSize || 1); };
Actor.prototype.getIntersecting = function() { return this.__world ? this.__world.allObjects().filter(actor => actor !== this && this.intersects(actor)) : []; };
Actor.prototype.getOneIntersecting = function() { return this.getIntersecting()[0] || null; };
Actor.prototype.isTouching = function() { return this.getIntersecting().length > 0; };
Actor.prototype.removeTouching = function() { const actor = this.getOneIntersecting(); if (actor) this.world.removeObject(actor); };
Actor.prototype._clamp = function() { if (this.__world) { this.x = clamp(this.x, 0, this.__world.width - 1); this.y = clamp(this.y, 0, this.__world.height - 1); } };

export function World(width, height, cellSize) { this.width = width; this.height = height; this.cellSize = cellSize; this._actors = []; this._background = new Image(width * cellSize, height * cellSize); this._background.setColor(255, 255, 255); this._background.fill(); this._texts = new Map(); }
World.prototype.act = function() {};
World.prototype.show = function() { state.world = this; };
World.prototype._findBackground = function() { const names = Object.getOwnPropertyNames(this); return names.map(name => this[name]).find(value => value instanceof Image && value !== this._background) || this._background; };
Object.defineProperties(World.prototype, { background: { get() { return this._findBackground(); }, set(value) { this._background = value; } }, numberOfObjects: { get() { return this._actors.length; } }, isClicked: { get() { return Boolean(state.click) && actorAt(state.click) === null && consumeClick(); } } });
World.prototype.addObject = function(actor, x, y) { if (actor.__world && actor.__world !== this) actor.__world.removeObject(actor); actor.__world = this; if (!this._actors.includes(actor)) this._actors.push(actor); actor.x = x; actor.y = y; actor._clamp(); };
World.prototype.removeObject = function(actor) { this._actors = this._actors.filter(item => item !== actor); if (actor.__world === this) actor.__world = null; };
World.prototype.allObjects = function() { return [...this._actors]; };
World.prototype.getObjects = function() { return [...this._actors]; };
World.prototype.getObjectsAt = function(x, y) { return this._actors.filter(actor => actor.x === x && actor.y === y); };
World.prototype.setBackground = function(value, g, b) { if (typeof value === 'string') { this._background = new Image(value); this._background.scale(this.width * this.cellSize, this.height * this.cellSize); } else { this._background = new Image(this.width * this.cellSize, this.height * this.cellSize); this._background.setColor(value, g, b); this._background.fill(); } };
World.prototype.showText = function(text, x, y) { const key = `${x}:${y}`; if (text) this._texts.set(key, [x, y, text]); else this._texts.delete(key); };

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
export const bluekStage = () => { const background = state.world?.background; const operations = background?.drawOperations || background?._operations || []; return JSON.stringify({ width: state.world?.width || 0, height: state.world?.height || 0, cellSize: state.world?.cellSize || 1, running: state.running, speed: state.speed, objects: state.world?.allObjects().map(actor => ({ type: actor.constructor.name || 'Actor', x: actor.x, y: actor.y, rotation: actor.rotation, imagePath: actor.image?.fileName || null, imageWidth: actor.image?.width || 30, imageHeight: actor.image?.height || 30, imageOpacity: (actor.image?.transparency ?? 255) / 255 })) || [], texts: state.world ? [...state.world._texts.values()].map(([x, y, text]) => ({ x, y, text })) : [], backgroundColor: background?.backgroundColor || background?._color || null, backgroundOperations: operations, sounds: state.sounds.splice(0) }); };
export const bluekStageJson = bluekStage;
export const bluekReadln = () => globalThis.__bluekReadln ? globalThis.__bluekReadln() : '';
export const bluekReadlnOrNull = () => globalThis.__bluekReadlnOrNull ? globalThis.__bluekReadlnOrNull() : null;
export const bluekStart = () => { if (typeof globalThis.main === 'function') globalThis.main(); };
globalThis.Actor = Actor; globalThis.World = World; globalThis.Image = Image;
Object.assign(globalThis, { isKeyDown, playSound, getSpeed, setSpeed, start, stop, step });
