import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

vm.runInThisContext(await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8'));
const api = globalThis['bluek-kotlite-browser'];
const complete = start => new Promise(resolve => {
  const result = JSON.parse(start(() => {}, value => resolve(JSON.parse(value))));
  if (result.kind === 'error') resolve(result);
});
const ok = (result, label) => { assert.notEqual(result.kind, 'error', `${label}: ${result.display}`); return result; };
async function create(files = [], sources = []) {
  const session = api.bluekCreateKotliteSession();
  session.configureBluePlay(true, 'blueplay-api-smoke');
  session.setBluePlayResources(`images/figure.png\0${40}\0${40}\0${'ff'.repeat(1600)}\nimages/mask.png\0${4}\0${4}\0${'ff000000'.repeat(4)}`);
  ok(await complete((input, done) => session.startLoadProject(files, sources, 'blueplay', 1, input, done)), 'load');
  return session;
}
const session = await create();
const evaluate = source => ok(JSON.parse(session.evaluate('<BluePlay API>', source)), source);

// Public signatures independently transcribed from the pinned BlueJ fixture,
// not from BlueK's adapter or its UI metadata.
const expected = {
  World: {
    constructors: ['width:Int,height:Int,cellSize:Int'],
    properties: ['val width:Int', 'val height:Int', 'val cellSize:Int', 'var background:Image', 'val numberOfObjects:Int', 'val isClicked:Boolean'],
    methods: ['show():Unit', 'act():Unit', 'addObject(actor:Actor,x:Int,y:Int):Unit', 'removeObject(actor:Actor):Unit', 'allObjects():List<Actor>', 'getObjects<T : Actor>():List<T>', 'getObjectsAt(x:Int,y:Int):List<Actor>', 'setBackground(fileName:String):Unit', 'setBackground(r:Int,g:Int,b:Int):Unit', 'showText(text:String,x:Int,y:Int):Unit'],
  },
  Actor: {
    constructors: [''],
    properties: ['val world:World', 'var image:Image?', 'var x:Int', 'var y:Int', 'var rotation:Int', 'val isAtEdge:Boolean', 'val isClicked:Boolean'],
    methods: ['act():Unit', 'move(distance:Int):Unit', 'turn(degrees:Int):Unit', 'turnTowards(x:Int,y:Int):Unit', 'distanceTo(other:Actor):Int', 'intersects(other:Actor):Boolean', 'getIntersecting<T : Actor>():List<T>', 'getOneIntersecting<T : Actor>():T?', 'isTouching<T : Actor>():Boolean', 'removeTouching<T : Actor>():Unit'],
  },
  Image: {
    constructors: ['width:Int,height:Int', 'fileName:String', 'other:Image'], properties: ['val width:Int', 'val height:Int'],
    methods: ['setColor(r:Int,g:Int,b:Int):Unit', 'fill():Unit', 'fillRect(x:Int,y:Int,w:Int,h:Int):Unit', 'drawRect(x:Int,y:Int,w:Int,h:Int):Unit', 'fillOval(x:Int,y:Int,w:Int,h:Int):Unit', 'drawOval(x:Int,y:Int,w:Int,h:Int):Unit', 'drawLine(x1:Int,y1:Int,x2:Int,y2:Int):Unit', 'drawString(text:String,x:Int,y:Int):Unit', 'drawImage(image:Image,x:Int,y:Int):Unit', 'clear():Unit', 'scale(width:Int,height:Int):Unit', 'setTransparency(value:Int):Unit'],
  },
};
const params = parameters => parameters.map(p => `${p.name}:${p.type.displayName}`).join(',');
const method = m => `${m.name}${m.typeParameters?.length ? '<' + m.typeParameters.join(',') + '>' : ''}(${params(m.parameters)}):${m.returnType.displayName}`;
const manifest = JSON.parse(session.manifest());
for (const klass of manifest.classes) {
  const original = expected[klass.name];
  assert(original, `Unexpected public library class ${klass.name}`);
  assert.deepEqual(klass.constructors.map(c => params(c.parameters)).sort(), original.constructors.slice().sort(), `${klass.name} constructors`);
  assert(klass.constructors.every(c => c.parameters.every(p => !p.hasDefault)), 'No implicit constructor arguments');
  assert.deepEqual(klass.properties.filter(p => p.visibility === 'public').map(p => `${p.mutable ? 'var' : 'val'} ${p.name}:${p.type.displayName}`).sort(), original.properties.slice().sort(), `${klass.name} properties`);
  assert.deepEqual(klass.methods.filter(m => m.visibility === 'public').map(method).sort(), original.methods.slice().sort(), `${klass.name} methods`);
  assert(klass.properties.every(p => p.visibility === 'public') && klass.methods.every(m => m.visibility === 'public'), 'Library internals must stay out of UI metadata');
}
assert.deepEqual(manifest.functions.map(method).sort(), ['isKeyDown(key:String):Boolean', 'start():Unit', 'stop():Unit', 'step():Unit', 'getSpeed():Int', 'setSpeed(value:Int):Unit', 'playSound(fileName:String):Unit'].sort());
const generated = JSON.parse(await readFile(new URL('../frontend/src/bluePlayApi.generated.json', import.meta.url), 'utf8'));
assert.deepEqual(generated, manifest, 'UI metadata must match the actual interpreter');
const bundled = await rolldown({ input: 'frontend/src/bluePlayApi.ts' });
const { output } = await bundled.generate({ format: 'esm' }); await bundled.close();
const { bluePlayApiDocs } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
for (const [file, doc] of Object.entries(bluePlayApiDocs)) {
  assert(doc.sections.every(section => section.members.every(member => member.description && member.signature)), `Missing explanation in ${file}`);
  const referenceCount = file === 'BluePlayFunctions.kt' ? 7 : (() => {const c = expected[file.replace('.kt', '')]; return c.constructors.length + c.properties.length + c.methods.length;})();
  assert.equal(doc.sections.flatMap(s => s.members).length, referenceCount, `${file} help must include every public member exactly once`);
}

// Ten original-valid probes failed in the audit; all must now work.
for (const source of [
  'val actors: List<Actor> = World(10, 10, 1).allObjects()',
  'val located: List<Actor> = World(10, 10, 1).getObjectsAt(0, 0)',
  'fun readX(w: World): Int = w.allObjects().first().x',
  'Image(width = 10, height = 10)', 'Image(fileName = "figure.png")', 'Image(other = Image(10, 10))',
  'Image(10, 10).setColor(r = 255, g = 0, b = 0)', 'Image(10, 10).fillRect(x = 0, y = 0, w = 5, h = 5)',
  'Image(10, 10).scale(width = 20, height = 20)', 'Actor().turnTowards(x = 5, y = 5)',
  'World(10, 10, 1).setBackground(r = 255, g = 0, b = 0)',
  'Image(10, 10).drawRect(x = 0, y = 0, w = 5, h = 5)', 'Image(10, 10).drawOval(x = 0, y = 0, w = 5, h = 5)', 'Image(10, 10).fillOval(x = 0, y = 0, w = 5, h = 5)',
]) evaluate(source);
for (const source of [
  'fun invalid(w: World) { w.addObject(7, 0, 0) }', 'fun invalid(w: World) { w.removeObject(7) }',
  'World(10, 10, 1).getObjects<String>()', 'World(10, 10)', 'Image()', 'Image(10)', 'Image(true)', 'Image(null)',
  'Actor().setLocation(3, 4)', 'Actor().setImage("figure.png")', 'Actor().getImage()', 'Actor().getX()', 'Actor().getY()',
  'Actor().getRotation()', 'Actor().setRotation(90)', 'Actor().isTouching(Actor())',
  'showWorld(World(10, 10, 1))', 'show()', 'activeWorld()', 'World(10, 10, 1).tick()',
  'Actor().worldWidth = 9', 'Actor().worldHeight = 9', 'Actor().worldCellSize = 9',
  'Image(10, 10).path = "figure.png"', 'Image(10, 10).transparency = 0', 'Image(10, 10).drawingJson()',
  'World(10, 10, 1).running = true', 'World(10, 10, 1).speed = 90',
]) {
  const result = JSON.parse((await create()).evaluate('<BluePlay invalid API>', source));
  assert.equal(result.kind, 'error', `Must reject ${source}`);
  assert.equal(result.phase, 'analysis', `Must reject at compile time: ${source}`);
}
assert.equal(evaluate('Image(0, -2).width.toString() + "," + Image(0, -2).height').display, '1,1');
assert.equal(evaluate('val a = Actor(); a.rotation = 90; a.turnTowards(0, 0); a.rotation').display, '90');

// Actors may exist detached, but operations requiring membership must fail;
// an uncaught error faults the session and prevents further execution.
for (const operation of ['actor.world', 'actor.isAtEdge', 'actor.isClicked', 'actor.intersects(Actor())', 'actor.getIntersecting<Actor>()', 'actor.getOneIntersecting<Actor>()', 'actor.isTouching<Actor>()', 'actor.removeTouching<Actor>()']) {
  const detachedSession = await create();
  const run = source => JSON.parse(detachedSession.evaluate('<detached actor>', source));
  assert.equal(ok(run('val actor = Actor(); actor.image = Image(2,2); actor.move(3); actor.turn(90); actor.x'), 'detached construction and movement').display, '3');
  const failure = run(operation);
  assert.equal(failure.kind, 'error', operation);
  assert.equal(failure.phase, 'runtime', operation);
  assert.equal(failure.fatal, true, operation);
  assert.match(failure.display, /IllegalStateException: The actor is not in a world/, operation);
  assert.match(run('1 + 1').display, /Runtime failed/, 'Uncaught membership failure requires reset or compile');
}
assert.equal(evaluate('val unattached = Actor(); try { unattached.world; false } catch (e: IllegalStateException) { true }').display, 'true', 'Detached world throws a catchable membership exception');
assert.equal(evaluate('try { unattached.isAtEdge; false } catch (e: IllegalStateException) { true }').display, 'true', 'Membership exceptions remain catchable as in Kotlin');
evaluate('val w = World(40,30,1); val b = Actor(); w.addObject(b, 3, 4); w.show()');
assert.equal(evaluate('val actorWorld: World = b.world; actorWorld === w').display, 'true', 'Attached world has a non-nullable type');
evaluate('fun catchDucks(actor: Actor) { for (duck in actor.world.getObjects<Actor>()) { if (actor.intersects(duck)) { actor.world.showText("Caught!", 10, 10); stop() } } }');
assert.equal(evaluate('w.allObjects().first().x').display, '3');
evaluate('val detached = w.allObjects(); w.removeObject(b); b.x = 99; b.y = 88');
assert.equal(evaluate('detached.size == 1 && w.numberOfObjects == 0 && b.x == 99 && b.y == 88').display, 'true');
assert.equal(evaluate('try { b.world; false } catch (e: IllegalStateException) { true }').display, 'true', 'Removed actors throw when their world is accessed');
evaluate('w.addObject(b, -1, 99)'); assert.equal(evaluate('b.x == 0 && b.y == 29').display, 'true');
const otherWorld = 'val otherWorld = World(50,50,1); otherWorld.addObject(b, 5, 5)'; evaluate(otherWorld);
assert.equal(evaluate('w.numberOfObjects == 0 && b.world === otherWorld').display, 'true');

// Original student files are immutable fixtures from GitHub, not BlueK examples.
const files = ['Figure.kt', 'MyWorld.kt', 'Main.kt'];
const original = await create(files, await Promise.all(files.map(file => readFile(new URL(`../tests/fixtures/blueplay-reference/${file}`, import.meta.url), 'utf8'))));
ok(await complete((input, done) => original.startBluePlayMain(null, input, done)), 'original main');
assert.deepEqual(JSON.parse(original.takeStage()).stage.objects.map(a => [a.x, a.y]), [[100, 200]]);
ok(await complete((input, done) => original.startBluePlayStep(input, done)), 'original step');
assert.equal(JSON.parse(original.takeStage()).stage.objects[0].x, 101);

// Copy and drawImage capture image contents and opacity at the call, rather than
// retaining a mutable receiver; scaling preserves these pixels at the new size.
evaluate('val source = Image("mask.png"); source.setTransparency(128); val target = Image(8,8); target.drawImage(source,2,2); source.clear(); b.image = target; otherWorld.show()');
const drawn = JSON.parse(session.takeStage()).stage.objects[0].image;
const decode = encoded => {
  let result = ''; for (let i = 0; i < encoded.length; i++) { const c = encoded[i]; if (c !== '\\' || i + 1 >= encoded.length) result += c; else { const next = encoded[++i]; result += next === 'p' ? '|' : next === 'n' ? '\n' : next; } } return JSON.parse(result);
};
const nested = decode(drawn.operations[0].split('|')[1].slice('__bluek:'.length));
assert.equal(nested.resourcePath, 'mask.png'); assert.equal(nested.opacity, 128 / 255);
evaluate('val copy = Image(other = target); target.clear(); b.image = copy; copy.scale(width = 16, height = 16)');
assert.equal(evaluate('copy.width == 16 && copy.height == 16').display, 'true');
assert(JSON.parse(session.takeStage()).stage.objects[0].image.operations.length, 'The copied drawing survives clearing the source and scaling');
// The copied mask has only its first column opaque; it doubles in size on scale.
evaluate('val point = Actor(); val dot = Image(1,1); dot.fill(); point.image = dot; otherWorld.addObject(point, 2, 5)');
assert.equal(evaluate('b.intersects(point)').display, 'true', 'Nested copied resource mask remains visible after scale');
evaluate('point.x = 4');
assert.equal(evaluate('b.intersects(point)').display, 'false', 'Transparent columns remain transparent after scale');
evaluate('point.x = 2; copy.setTransparency(0)');
assert.equal(evaluate('b.intersects(point)').display, 'false', 'Outer transparency applies to copied pixels');
evaluate('copy.setTransparency(255)');
assert.equal(evaluate('b.intersects(point)').display, 'true', 'Restoring opacity restores copied pixels');
console.log('BluePlay API conformance passed: reference signatures including non-nullable world, UI metadata, 14 valid / 28 invalid calls, direct world access, original GitHub example, object lifecycle and image copies.');
