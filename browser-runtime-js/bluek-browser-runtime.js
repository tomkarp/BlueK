// Fixed JavaScript BluePlay runtime. Function constructors are intentional:
// Kotlin/JS ES5 output calls base constructors with Base.call(this, ...).
const state = { world: null, running: false, speed: 50, keys: new Set(), clicks: [], sounds: [] };
const resourceSizes = new Map();
const applyResourceSizes = values => { resourceSizes.clear(); Object.entries(values || {}).forEach(([key, value]) => { if (value && Number(value.width) > 0 && Number(value.height) > 0) { const size = { width: Number(value.width), height: Number(value.height), alpha: Array.isArray(value.alpha) ? value.alpha : null }; resourceSizes.set(key, size); resourceSizes.set(key.replace(/^images\//, ''), size); } }); };
if (globalThis.__bluekPendingResourceSizes) applyResourceSizes(globalThis.__bluekPendingResourceSizes);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const color = (r, g, b) => `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;
const imageReference = image => image.fileName || `__bluek:${encodeURIComponent(JSON.stringify({ width: image.width, height: image.height, operations: image._operations }))}`;

export function Image(value, height) {
  this.fileName = typeof value === 'string' ? value : null;
  const resourceSize = typeof value === 'string' ? resourceSizes.get(value) || resourceSizes.get(`images/${value}`) : undefined;
  this.width = typeof value === 'number' ? Math.max(1, value) : resourceSize?.width || 30;
  this.height = typeof value === 'number' ? Math.max(1, height) : resourceSize?.height || 30;
  this._alphaMask = typeof value === 'string' ? resourceSize?.alpha || null : null;
  this._alphaWidth = typeof value === 'string' ? resourceSize?.width || this.width : this.width;
  this._alphaHeight = typeof value === 'string' ? resourceSize?.height || this.height : this.height;
  if (value instanceof Image) { this.fileName = value.fileName; this.width = value.width; this.height = value.height; this._alphaMask = value._alphaMask ? [...value._alphaMask] : null; this._alphaWidth = value._alphaWidth; this._alphaHeight = value._alphaHeight; }
  this.transparency = value instanceof Image ? value.transparency : 255;
  this._color = value instanceof Image ? value._color : 'rgb(0, 0, 0)'; this._operations = value instanceof Image ? [...value._operations] : [];
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
Image.prototype.drawString = function(text, x, y) { this._op('drawString', encodeURIComponent(String(text)), x, y); };
Image.prototype.drawImage = function(image, x, y) { this._operations.push(['drawImage', imageReference(image), x, y, image.width, image.height].join('|')); };
Image.prototype.clear = function() { this._operations = []; };
Image.prototype.overlaps = function(other) { return Boolean(other); };
Object.defineProperties(Image.prototype, { drawOperations: { get() { return [...this._operations]; } }, backgroundColor: { get() { return this._operations.at(-1)?.split('|').at(-1) || this._color; } } });

export function Actor() { this.x = 0; this.y = 0; this.rotation = 0; this.image = null; this.__world = null; }
Actor.prototype.act = function() {};
Object.defineProperties(Actor.prototype, {
  world: { get() { if (!this.__world) throw new Error('The actor is not in a world.'); return this.__world; } },
  isAtEdge: { get() { return this.__world ? this.x <= 0 || this.y <= 0 || this.x >= this.__world.width - 1 || this.y >= this.__world.height - 1 : false; } },
  isClicked: { get() { return actorAt(currentClick()) === this && consumeClick(); } }
});
Actor.prototype.move = function(distance) { const radians = this.rotation * Math.PI / 180; this.x += Math.round(Math.cos(radians) * distance); this.y += Math.round(Math.sin(radians) * distance); this._clamp(); };
Actor.prototype.turn = function(degrees) { this.rotation = ((this.rotation + degrees) % 360 + 360) % 360; };
Actor.prototype.turnTowards = function(x, y) { if (x !== this.x || y !== this.y) this.rotation = Math.round(Math.atan2(y - this.y, x - this.x) * 180 / Math.PI); };
Actor.prototype.distanceTo = function(other) { return Math.round(Math.hypot(other.x - this.x, other.y - this.y)); };
Actor.prototype.intersects = function(other) {
  if (!other || this === other) return false;
  const firstImage = this.image, secondImage = other.image;
  if ((firstImage?.transparency ?? 255) <= 16 || (secondImage?.transparency ?? 255) <= 16) return false;
  const corners = actor => {
    const image = actor.image, cellSize = Math.max(1, actor.__world?.cellSize || 1);
    const halfWidth = (image?.width || 30) / cellSize / 2, halfHeight = (image?.height || 30) / cellSize / 2;
    const angle = (actor.rotation || 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    return [[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight]].map(([x, y]) => [actor.x + cos * x - sin * y, actor.y + sin * x + cos * y]);
  };
  const first = corners(this), second = corners(other);
  const axes = [];
  for (const polygon of [first, second]) for (let index = 0; index < 2; index += 1) { const [x1, y1] = polygon[index], [x2, y2] = polygon[index + 1]; axes.push([-(y2 - y1), x2 - x1]); }
  if (!axes.every(([axisX, axisY]) => {
    const project = polygon => polygon.map(([x, y]) => x * axisX + y * axisY);
    const one = project(first), two = project(second);
    return Math.max(...one) >= Math.min(...two) && Math.max(...two) >= Math.min(...one);
  })) return false;
  if (!firstImage?._alphaMask || !secondImage?._alphaMask) return true;
  const cellSize = Math.max(1, this.__world?.cellSize || 1), otherCellSize = Math.max(1, other.__world?.cellSize || 1);
  const firstCenter = [(this.x + 0.5) * cellSize, (this.y + 0.5) * cellSize], secondCenter = [(other.x + 0.5) * otherCellSize, (other.y + 0.5) * otherCellSize];
  const sample = (image, center, actor, pixelX, pixelY) => {
    const radians = -(actor.rotation || 0) * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
    const dx = pixelX + 0.5 - center[0], dy = pixelY + 0.5 - center[1];
    const localX = cos * dx - sin * dy + image.width / 2, localY = sin * dx + cos * dy + image.height / 2;
    const x = Math.floor(localX), y = Math.floor(localY);
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return false;
    const maskWidth = image._alphaWidth || image.width, maskHeight = image._alphaHeight || image.height;
    const maskX = Math.min(maskWidth - 1, Math.floor(x * maskWidth / image.width));
    const maskY = Math.min(maskHeight - 1, Math.floor(y * maskHeight / image.height));
    return image._alphaMask[maskY * maskWidth + maskX] > 16;
  };
  const left = Math.floor(Math.max(0, Math.min(...first.map(point => point[0])) * cellSize)), right = Math.ceil(Math.max(...first.map(point => point[0])) * cellSize);
  const top = Math.floor(Math.max(0, Math.min(...first.map(point => point[1])) * cellSize)), bottom = Math.ceil(Math.max(...first.map(point => point[1])) * cellSize);
  for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) if (sample(firstImage, firstCenter, this, x, y) && sample(secondImage, secondCenter, other, x, y)) return true;
  return false;
};
Actor.prototype.getIntersecting = function() { return this.__world ? this.__world.allObjects().filter(actor => actor !== this && this.intersects(actor)) : []; };
Actor.prototype.getOneIntersecting = function() { return this.getIntersecting()[0] || null; };
Actor.prototype.isTouching = function() { return this.getIntersecting().length > 0; };
Actor.prototype.removeTouching = function() { const actor = this.getOneIntersecting(); if (actor) this.world.removeObject(actor); };
Actor.prototype.bluekGetIntersecting = function() { return this.getIntersecting(); };
Actor.prototype.bluekGetOneIntersecting = function() { return this.getOneIntersecting(); };
Actor.prototype.bluekIsTouching = function() { return this.isTouching(); };
Actor.prototype.bluekRemoveTouching = function() { return this.removeTouching(); };
Actor.prototype._clamp = function() { if (this.__world) { this.x = clamp(this.x, 0, this.__world.width - 1); this.y = clamp(this.y, 0, this.__world.height - 1); } };

export function World(width, height, cellSize) { this.width = width; this.height = height; this.cellSize = cellSize; this._actors = []; this._background = new Image(width * cellSize, height * cellSize); this._background.setColor(255, 255, 255); this._background.fill(); this._texts = new Map(); }
World.prototype.act = function() {};
World.prototype.show = function() { state.world = this; };
World.prototype._findBackground = function() { const names = Object.getOwnPropertyNames(this); return names.map(name => this[name]).find(value => value instanceof Image && value !== this._background) || this._background; };
Object.defineProperties(World.prototype, { background: { get() { return this._findBackground(); }, set(value) { this._background = value; } }, numberOfObjects: { get() { return this._actors.length; } }, isClicked: { get() { return state.clicks.length > 0 && actorAt(currentClick()) === null && consumeClick(); } } });
World.prototype.addObject = function(actor, x, y) { if (actor.__world && actor.__world !== this) actor.__world.removeObject(actor); actor.__world = this; if (!this._actors.includes(actor)) this._actors.push(actor); actor.x = x; actor.y = y; actor._clamp(); };
World.prototype.removeObject = function(actor) { this._actors = this._actors.filter(item => item !== actor); if (actor.__world === this) actor.__world = null; };
World.prototype.allObjects = function() { return [...this._actors]; };
World.prototype.getObjects = function() { return [...this._actors]; };
World.prototype.bluekAllObjects = function() { return this.allObjects(); };
World.prototype.getObjectsAt = function(x, y) { return this._actors.filter(actor => actor.x === x && actor.y === y); };
World.prototype.setBackground = function(value, g, b) { if (typeof value === 'string') { this._background = new Image(value); this._background.scale(this.width * this.cellSize, this.height * this.cellSize); } else { this._background = new Image(this.width * this.cellSize, this.height * this.cellSize); this._background.setColor(value, g, b); this._background.fill(); } };
World.prototype.showText = function(text, x, y) { const key = `${x}:${y}`; if (text) this._texts.set(key, [x, y, text]); else this._texts.delete(key); };

export const isKeyDown = key => state.keys.has(String(key).toLowerCase());
export const playSound = fileName => state.sounds.push(String(fileName));
export const getSpeed = () => state.speed;
export const bluekIsRunning = () => state.running;
export const setSpeed = value => { state.speed = clamp(Number(value), 1, 100); };
export const start = () => { state.running = true; };
export const stop = () => { state.running = false; };
export const step = () => { if (!state.running) oneStep(); };
export const bluekRun = start;
export const bluekPause = stop;
export const bluekSetSpeed = setSpeed;
export const bluekAct = step;
export const bluekKey = (key, pressed) => pressed ? state.keys.add(String(key).toLowerCase()) : state.keys.delete(String(key).toLowerCase());
export const bluekClick = (x, y) => { state.clicks.push({ x, y }); };
// Browser input is expressed in world cells, while Image dimensions are pixels.
// Keep hit testing in the same coordinate system as World.addObject(x, y).
const currentClick = () => state.clicks[0] || null;
const actorAt = point => state.world?.allObjects().slice().reverse().find(actor => {
  const image = actor.image, cellSize = Math.max(1, state.world.cellSize || 1);
  const halfWidth = (image?.width || 30) / (2 * cellSize), halfHeight = (image?.height || 30) / (2 * cellSize);
  const radians = (actor.rotation || 0) * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const deltaX = (point?.x ?? NaN) - (actor.x + 0.5), deltaY = (point?.y ?? NaN) - (actor.y + 0.5);
  const localX = cos * deltaX + sin * deltaY, localY = -sin * deltaX + cos * deltaY;
  return Number.isFinite(localX) && Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight;
});
const consumeClick = () => { if (!state.clicks.length) return false; state.clicks.shift(); return true; };
const oneStep = () => { if (!state.world) return; state.world.act(); state.world.allObjects().slice().forEach(actor => actor.act()); };
export const bluekStep = () => { if (state.running) oneStep(); };
export const bluekStage = () => { const background = state.world?.background; const operations = background?.drawOperations || background?._operations || []; return JSON.stringify({ width: state.world?.width || 0, height: state.world?.height || 0, cellSize: state.world?.cellSize || 1, running: state.running, speed: state.speed, objects: state.world?.allObjects().map(actor => ({ type: actor.constructor.name || 'Actor', x: actor.x, y: actor.y, rotation: actor.rotation, hasImage: actor.image !== null, imagePath: actor.image?.fileName || null, imageWidth: actor.image?.width || 30, imageHeight: actor.image?.height || 30, imageOpacity: (actor.image?.transparency ?? 255) / 255, imageOperations: actor.image ? actor.image.drawOperations : null })) || [], texts: state.world ? [...state.world._texts.values()].map(([x, y, text]) => ({ x, y, text })) : [], backgroundColor: background?.backgroundColor || background?._color || null, backgroundOperations: operations, sounds: state.sounds.splice(0) }); };
export const bluekStageJson = bluekStage;
export const bluekReadln = () => globalThis.__bluekReadln ? globalThis.__bluekReadln() : '';
export const bluekReadlnOrNull = () => globalThis.__bluekReadlnOrNull ? globalThis.__bluekReadlnOrNull() : null;
export const bluekSetResourceSizes = applyResourceSizes;
const matchesType = (actor, typeName) => !typeName || actor?.constructor?.name === String(typeName).split('.').pop();
export const bluekActorGetIntersecting = (actor, typeName) => (actor?.getIntersecting?.() || []).filter(value => matchesType(value, typeName));
export const bluekActorGetOneIntersecting = (actor, typeName) => bluekActorGetIntersecting(actor, typeName)[0] || null;
export const bluekActorIsTouching = (actor, typeName) => bluekActorGetIntersecting(actor, typeName).length > 0;
export const bluekActorRemoveTouching = (actor, typeName) => { const hit = bluekActorGetOneIntersecting(actor, typeName); if (hit) actor?.world?.removeObject?.(hit); };
export const bluekWorldAllObjects = (world, typeName) => (world?.allObjects?.() || []).filter(value => matchesType(value, typeName));
export const bluekStart = () => { if (typeof globalThis.main === 'function') globalThis.main(); };
globalThis.Actor = Actor; globalThis.World = World; globalThis.Image = Image;
Object.assign(globalThis, { isKeyDown, playSound, getSpeed, setSpeed, start, stop, step, bluekActorGetIntersecting, bluekActorGetOneIntersecting, bluekActorIsTouching, bluekActorRemoveTouching, bluekWorldAllObjects });
