import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const bundle = await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8');
vm.runInThisContext(bundle, { filename: 'bluek-kotlite-browser.js' });
const api = globalThis['bluek-kotlite-browser'];
// The graphics BlueK ships with are announced to the runtime like project
// resources; only their paths are needed to tell a typo from a real file.
const standardImages = [...(await readFile(new URL('../frontend/src/standardImages.generated.ts', import.meta.url), 'utf8'))
  .matchAll(/path: "images\/([^"]+)"/g)].map(match => match[1]);
if (!standardImages.includes('figure.png') || !standardImages.includes('duck.png')) throw new Error('The standard graphics manifest is missing BluePlay names.');
const standardManifest = standardImages.map(name => `images/${name}\0\0\0`).join('\n');
const staticProject = JSON.parse(await readFile(new URL('../frontend/public/examples/blueplay.bluek.json', import.meta.url), 'utf8'));
const figureResource = staticProject.resources?.find(resource => resource.path === 'images/figure.png');
if (!figureResource?.data?.startsWith('data:image/png;base64,')) throw new Error('The bundled BluePlay example image is missing from the static project asset.');
if (staticProject.library?.id !== 'blueplay' || staticProject.library.version !== 1) throw new Error('The bundled BluePlay example must declare library blueplay v1.');
const expectOk = (json, label) => {
  if (json.kind === 'error') throw new Error(`${label}: ${json.display}`);
  return json;
};
// Native library path: only student files are sent to the session, while the
// built-in World/Actor/Image/Functions declarations come from the runtime.
const nativeSession = api.bluekCreateKotliteSession();
nativeSession.configureBluePlay(true, 'native-blueplay-smoke');
nativeSession.setBluePlayResources(standardManifest);
const nativeFiles = ['Figure.kt', 'MyWorld.kt', 'Main.kt'];
const nativeSources = await Promise.all(nativeFiles.map(file => readFile(new URL(`../examples/blueplay/${file}`, import.meta.url), 'utf8')));
const awaitCompletion = (start) => new Promise(resolve => {
  const started = JSON.parse(start(() => {}, value => resolve(JSON.parse(value))));
  if (started.kind === 'error') resolve(started);
});
const nativeLoad = await awaitCompletion((onInput, onComplete) => nativeSession.startLoadProject(nativeFiles, nativeSources, 'blueplay', 1, onInput, onComplete));
expectOk(nativeLoad, 'native project load');
expectOk(await awaitCompletion((onInput, onComplete) => nativeSession.startBluePlayMain(null, onInput, onComplete)), 'native main');
const nativeInitial = JSON.parse(nativeSession.takeStage()).stage;
if (nativeInitial.objects[0]?.x !== 100) throw new Error('Native BluePlay library did not render the actor from main().');
expectOk(await awaitCompletion((onInput, onComplete) => nativeSession.startBluePlayStep(onInput, onComplete)), 'native step');
const nativeMoved = JSON.parse(nativeSession.takeStage()).stage;
if (nativeMoved.objects[0]?.x !== 101) throw new Error('Native BluePlay scheduler did not dispatch Actor.act().');

// Public step() uses the same student callbacks as a scheduler step.
const nativeEval = (source, label) => expectOk(JSON.parse(nativeSession.evaluate('<BluePlay public API>', source)), label);
nativeEval('step()', 'public step');
if (JSON.parse(nativeSession.takeStage()).stage.objects[0]?.x !== 102) throw new Error('Public step() did not dispatch the actor callback.');
nativeEval('class CallbackWorld : World(40,30,1) { var acts = 0; override fun act() { acts += 1 } }; val callbacks = CallbackWorld(); callbacks.show(); step()', 'world override');
if (nativeEval('callbacks.acts', 'world act result').display !== '1') throw new Error('Public step() ignored World.act().');
nativeEval('callbacks.showText("hello",2,3); callbacks.showText("replaced",2,3); callbacks.setBackground(12,34,56); setSpeed(101)', 'text, color and speed');
const decorated = JSON.parse(nativeSession.takeStage()).stage;
if (decorated.texts.length !== 1 || decorated.texts[0].text !== 'replaced' || decorated.background.operations[0] !== 'fill|rgb(12,34,56)' || decorated.speed !== 100) throw new Error('World decorations or speed bridge failed.');

// playSound() resolves the project resource like BluePlay (given path, then sounds/),
// emits a sound effect independent of the shown world, and fails loudly for a missing file.
const soundSession = api.bluekCreateKotliteSession();
soundSession.configureBluePlay(true, 'sound-smoke');
soundSession.setBluePlayResources(`${standardManifest}\nsounds/step.wav\0\0\0\nsounds/music.mp3\0\0\0`);
expectOk(await awaitCompletion((onInput, onComplete) => soundSession.startLoadProject([], [], 'blueplay', 1, onInput, onComplete)), 'sound project load');
const soundEval = (source) => JSON.parse(soundSession.evaluate('<BluePlay sound>', source));
expectOk(soundEval('playSound("step.wav"); playSound("sounds/music.mp3"); playSound("step.wav")'), 'play sounds without a world');
assert.deepEqual(JSON.parse(soundSession.takeEffects()), [
  { type: 'sound', name: 'resource', path: 'sounds/step.wav' },
  { type: 'sound', name: 'resource', path: 'sounds/music.mp3' },
  { type: 'sound', name: 'resource', path: 'sounds/step.wav' },
]);
assert.deepEqual(JSON.parse(soundSession.takeEffects()), []);
const missingSound = soundEval('playSound("stpe.wav")');
if (missingSound.kind !== 'error' || !missingSound.display.includes("Sound file not found: stpe.wav (expected e.g. in the folder 'sounds/'). Available: music.mp3, step.wav."))
  throw new Error(`A missing sound did not fail like BluePlay: ${missingSound.display}`);
if (JSON.parse(soundSession.takeEffects()).length) throw new Error('A missing sound produced an effect.');
nativeEval('callbacks.showText("",2,3)', 'remove text');
if (JSON.parse(nativeSession.takeStage()).stage.texts.length) throw new Error('An empty string did not remove world text.');
nativeEval('val moving = Actor(); moving.x = 10; moving.y = 10; moving.rotation = 45; moving.move(10)', 'diagonal movement');
if (nativeEval('moving.x == 17 && moving.y == 17', 'diagonal movement result').display !== 'true') throw new Error('Movement at arbitrary headings failed.');
nativeEval('moving.rotation = 450; moving.turn(-540)', 'normalize rotation');
if (nativeEval('moving.rotation', 'normalized direction').display !== '270') throw new Error('Rotation was not normalized.');

// BlueJ step() is ignored during Run; showing a world pauses Run.
nativeSession.takeBluePlayIntent();
nativeSession.setBluePlayRunningQuery(() => true);
nativeEval('step()', 'step during run');
if (nativeEval('callbacks.acts', 'ignored step result').display !== '1') throw new Error('step() ran while the scheduler was running.');
nativeEval('callbacks.show()', 'show pauses run');
if (nativeSession.takeBluePlayIntent() !== 'stop') throw new Error('World.show() did not pause simulation like BlueJ.');
nativeSession.setBluePlayRunningQuery(() => false);

// A click targets the visible actor identity, not merely its centre cell. The
// actor may safely remove itself while the scheduler is iterating the frame.
const removalSession = api.bluekCreateKotliteSession();
removalSession.configureBluePlay(true, 'native-blueplay-removal');
removalSession.setBluePlayResources(`images/mask.png\0${4}\0${4}\0${'ff'.repeat(16)}`);
const removalFiles = ['RemovingActor.kt', 'Main.kt'];
const removalSources = [
  'class RemovingActor : Actor() { init { image = Image("mask.png") }; override fun act() { if (isClicked) world.removeObject(this) } }',
  'val removalWorld = World(30, 20, 1); val removalActor = RemovingActor(); val secondRemovalActor = RemovingActor(); fun main() { removalWorld.addObject(removalActor, 10, 10); removalWorld.addObject(secondRemovalActor, 20, 10); removalWorld.show() }',
];
expectOk(await awaitCompletion((onInput, onComplete) => removalSession.startLoadProject(removalFiles, removalSources, 'blueplay', 1, onInput, onComplete)), 'self-removal project load');
expectOk(await awaitCompletion((onInput, onComplete) => removalSession.startBluePlayMain(null, onInput, onComplete)), 'self-removal main');
const removableStage = JSON.parse(removalSession.takeStage()).stage;
if (removableStage.objects.length !== 2 || removableStage.images[removableStage.objects[0]?.image]?.width !== 4 || !removableStage.objects[0]?.hitId || !removableStage.objects[1]?.hitId) throw new Error('Runtime image metadata or stable hit identity is missing.');
// Both actors look alike: the frame lists their image once.
if (removableStage.images.length !== 1 || removableStage.objects[1].image !== 0) throw new Error('A frame repeats an image instead of referring to it.');
expectOk(JSON.parse(removalSession.setClick(7, 10, removableStage.objects[0].hitId)), 'off-centre actor click');
if (expectOk(JSON.parse(removalSession.evaluate('<BluePlay removal smoke>', 'removalActor.isClicked')), 'off-centre actor query').display !== 'true') throw new Error('Stable actor click identity was not delivered outside the centre cell.');
expectOk(JSON.parse(removalSession.setClick(7, 10, removableStage.objects[0].hitId)), 'off-centre actor click before removal');
expectOk(await awaitCompletion((onInput, onComplete) => removalSession.startBluePlayStep(onInput, onComplete)), 'clicked actor self-removal');
const removedByClickStage = JSON.parse(removalSession.takeStage()).stage;
if (removedByClickStage.objects.length !== 1) throw new Error('A clicked Actor could not remove itself safely.');
if (expectOk(JSON.parse(removalSession.evaluate('<BluePlay removal smoke>', 'removalWorld.getObjects<RemovingActor>().size')), 'one remaining actor world size').display !== '1') throw new Error('World.getObjects lost the wrong Actor or retained the removed Actor.');
expectOk(JSON.parse(removalSession.setClick(17, 10, removableStage.objects[1].hitId)), 'second off-centre actor click');
expectOk(await awaitCompletion((onInput, onComplete) => removalSession.startBluePlayStep(onInput, onComplete)), 'second clicked actor self-removal');
const allRemovedStage = JSON.parse(removalSession.takeStage()).stage;
if (allRemovedStage.objects.length !== 0) throw new Error('The second clicked Actor could not remove itself safely.');
if (expectOk(JSON.parse(removalSession.evaluate('<BluePlay removal smoke>', 'removalWorld.getObjects<RemovingActor>().size')), 'empty actor world size').display !== '0') throw new Error('World.getObjects still retained a self-removed Actor.');
// Removal forgets the hit identity; a re-added actor receives a usable one again.
expectOk(JSON.parse(removalSession.evaluate('<BluePlay removal smoke>', 'removalWorld.addObject(removalActor, 10, 10)')), 're-add removed actor');
const readdedStage = JSON.parse(removalSession.takeStage()).stage;
if (readdedStage.objects.length !== 1 || !readdedStage.objects[0]?.hitId) throw new Error('A re-added Actor has no hit identity.');
expectOk(JSON.parse(removalSession.setClick(7, 10, readdedStage.objects[0].hitId)), 're-added actor click');
if (expectOk(JSON.parse(removalSession.evaluate('<BluePlay removal smoke>', 'removalActor.isClicked')), 're-added actor query').display !== 'true') throw new Error('A re-added Actor did not receive a click through its new hit identity.');

// Bounding boxes overlap here, but only the left source column is opaque. The
// actors touch only after they share the same visible pixels.
const collisionSession = api.bluekCreateKotliteSession();
collisionSession.configureBluePlay(true, 'native-blueplay-alpha-collision');
collisionSession.setBluePlayResources(`images/mask.png\0${4}\0${4}\0${'ff000000'.repeat(4)}`);
const collisionFiles = ['MaskActor.kt', 'Collision.kt'];
const collisionSources = [
  'class MaskActor : Actor() { init { image = Image("mask.png") } }',
  'val pixelWorld = World(30, 20, 1); val pixelA = MaskActor(); val pixelB = MaskActor(); fun main() { pixelWorld.addObject(pixelA, 10, 10); pixelWorld.addObject(pixelB, 11, 10); pixelWorld.show() }',
];
expectOk(await awaitCompletion((onInput, onComplete) => collisionSession.startLoadProject(collisionFiles, collisionSources, 'blueplay', 1, onInput, onComplete)), 'alpha collision project load');
expectOk(await awaitCompletion((onInput, onComplete) => collisionSession.startBluePlayMain(null, onInput, onComplete)), 'alpha collision main');
const collisionEvaluate = (source, label) => expectOk(JSON.parse(collisionSession.evaluate('<BluePlay alpha smoke>', source)), label);
if (collisionEvaluate('pixelA.intersects(pixelB)', 'transparent overlap').display !== 'false') throw new Error('Transparent source pixels incorrectly triggered isTouching.');
collisionEvaluate('pixelB.x = 10', 'opaque overlap setup');
collisionEvaluate('pixelB.rotation = 180', 'rotated transparent overlap setup');
if (collisionEvaluate('pixelA.intersects(pixelB)', 'rotated transparent overlap').display !== 'false') throw new Error('Rotated transparent pixels incorrectly triggered isTouching.');
collisionEvaluate('pixelB.rotation = 0', 'visible overlap setup');
if (collisionEvaluate('pixelA.intersects(pixelB)', 'opaque overlap').display !== 'true') throw new Error('Visible source pixels did not trigger isTouching.');

// Pixel-exact collisions of unrotated actors use a visibility map per image.
// Compare them with the per-pixel rule for odd and even image sizes: pixel
// centres inside both images' bounds, where both images are opaque.
{
  const mapSession = api.bluekCreateKotliteSession();
  mapSession.configureBluePlay(true, 'native-blueplay-visibility-map');
  const shapes = { a: { w: 9, h: 7, rect: [2, 1, 4, 5] }, b: { w: 6, h: 5, rect: [1, 1, 3, 2] } };
  const image = ({ w, h, rect }) => `Image(${w}, ${h}).also { it.fillRect(${rect.join(', ')}) }`;
  expectOk(await awaitCompletion((onInput, onComplete) => mapSession.startLoadProject(['Probe.kt', 'Main.kt'], [
    'class Probe : Actor()',
    `val mapWorld = World(60, 60, 1); val first = Probe(); val second = Probe()
fun main() { first.image = ${image(shapes.a)}; second.image = ${image(shapes.b)}; mapWorld.addObject(first, 20, 20); mapWorld.addObject(second, 20, 20) }
fun probe(): String { var result = ""; var dy = -7; while (dy <= 7) { var dx = -9; while (dx <= 9) { second.x = 20 + dx; second.y = 20 + dy; result += if (first.intersects(second)) "1" else "0"; dx += 1 }; dy += 1 }; return result }`,
  ], 'blueplay', 1, onInput, onComplete)), 'visibility map project load');
  expectOk(await awaitCompletion((onInput, onComplete) => mapSession.startBluePlayMain(null, onInput, onComplete)), 'visibility map main');
  const visible = ({ w, h, rect: [left, top, width, height] }, x, y, pixelX, pixelY) => {
    const localX = pixelX - (x + 0.5) + w / 2, localY = pixelY - (y + 0.5) + h / 2;
    return localX >= 0 && localY >= 0 && localX < w && localY < h && localX >= left && localX < left + width && localY >= top && localY < top + height;
  };
  const touches = (dx, dy) => {
    const placed = [[shapes.a, 20, 20], [shapes.b, 20 + dx, 20 + dy]];
    const bounds = placed.map(([{ w, h }, x, y]) => [x + 0.5 - w / 2, y + 0.5 - h / 2, x + 0.5 + w / 2, y + 0.5 + h / 2]);
    const left = Math.max(bounds[0][0], bounds[1][0]), top = Math.max(bounds[0][1], bounds[1][1]);
    const right = Math.min(bounds[0][2], bounds[1][2]), bottom = Math.min(bounds[0][3], bounds[1][3]);
    if (left >= right || top >= bottom) return false;
    for (let y = Math.floor(top); y < Math.ceil(bottom); y++)
      for (let x = Math.floor(left); x < Math.ceil(right); x++)
        if (placed.every(([shape, ax, ay]) => visible(shape, ax, ay, x + 0.5, y + 0.5))) return true;
    return false;
  };
  let expected = '';
  for (let dy = -7; dy <= 7; dy++) for (let dx = -9; dx <= 9; dx++) expected += touches(dx, dy) ? '1' : '0';
  const actual = expectOk(JSON.parse(mapSession.evaluate('<visibility map>', 'probe()')), 'visibility map probe').display;
  if (actual !== expected) throw new Error(`Collisions from visibility maps differ from the per-pixel rule:\n${actual}\n${expected}`);
  if (!expected.includes('1') || !expected.includes('0')) throw new Error('The visibility map probe must cover touching and separate positions.');
}

// The engine groups actors by class for queries; results keep the world's
// order across classes. Re-adding keeps an actor's place; moving it to another
// world and back puts it last, like the BlueJ list.
{
  const orderSession = api.bluekCreateKotliteSession();
  orderSession.configureBluePlay(true, 'native-blueplay-order');
  expectOk(await awaitCompletion((onInput, onComplete) => orderSession.startLoadProject(['Shape.kt', 'Circle.kt', 'Square.kt', 'Main.kt'], [
    'open class Shape(val label: String) : Actor()',
    'class Circle(label: String) : Shape(label)',
    'class Square(label: String) : Shape(label)',
    `val shapes = World(50, 50, 1); val elsewhere = World(50, 50, 1)
val c1 = Circle("c1"); val s1 = Square("s1"); val c2 = Circle("c2"); val s2 = Square("s2")
fun main() { shapes.addObject(c1, 5, 5); shapes.addObject(s1, 5, 5); shapes.addObject(c2, 6, 6); shapes.addObject(s2, 5, 5); shapes.show() }
fun labels(actors: List<Shape>): String = actors.joinToString(",") { it.label }`,
  ], 'blueplay', 1, onInput, onComplete)), 'order project load');
  expectOk(await awaitCompletion((onInput, onComplete) => orderSession.startBluePlayMain(null, onInput, onComplete)), 'order main');
  const orderOf = source => expectOk(JSON.parse(orderSession.evaluate('<order>', source)), source).display;
  const expectOrder = (source, expected) => {
    const actual = orderOf(source);
    if (actual !== expected) throw new Error(`${source}: expected ${expected}, got ${actual}`);
  };
  expectOrder('labels(shapes.getObjects<Shape>())', 'c1,s1,c2,s2');
  expectOrder('labels(shapes.getObjects<Square>())', 's1,s2');
  orderOf('shapes.addObject(c1, 5, 5)');
  expectOrder('labels(shapes.getObjects<Shape>())', 'c1,s1,c2,s2');
  orderOf('elsewhere.addObject(s1, 5, 5); shapes.addObject(s1, 5, 5)');
  expectOrder('labels(shapes.getObjects<Shape>())', 'c1,c2,s2,s1');
  expectOrder('labels(c2.getIntersecting<Shape>())', 'c1,s2,s1');
  expectOrder('c2.getOneIntersecting<Shape>()?.label ?: "none"', 'c1');
  expectOrder('s2.getOneIntersecting<Square>()?.label ?: "none"', 's1');
  expectOrder('shapes.getObjectsAt(5, 5).size', '3');
  expectOrder('shapes.numberOfObjects', '4');
  const frameOrder = JSON.parse(orderSession.takeStage()).stage.objects.map(object => object.className).join(',');
  if (frameOrder !== 'Circle,Circle,Square,Square') throw new Error(`Frames must paint in world order: ${frameOrder}`);
}

// RT-51: worlds know their actors by identity. Actors that are equal by an
// overridden equals are still separate members, removed and found separately.
{
  const identitySession = api.bluekCreateKotliteSession();
  identitySession.configureBluePlay(true, 'native-blueplay-identity');
  expectOk(await awaitCompletion((onInput, onComplete) => identitySession.startLoadProject(['Coin.kt', 'Main.kt'], [
    'class Coin(val label: String) : Actor() { override fun equals(other: Any?): Boolean = other is Coin\n override fun hashCode(): Int = 1 }',
    `val purse = World(20, 20, 1); val first = Coin("first"); val second = Coin("second")
fun main() { purse.addObject(first, 5, 5); purse.addObject(second, 5, 5) }`,
  ], 'blueplay', 1, onInput, onComplete)), 'identity project load');
  expectOk(await awaitCompletion((onInput, onComplete) => identitySession.startBluePlayMain(null, onInput, onComplete)), 'identity main');
  const valueOf = source => expectOk(JSON.parse(identitySession.evaluate('<identity>', source)), source).display;
  const expectValue = (source, expected) => {
    const actual = valueOf(source);
    if (actual !== expected) throw new Error(`${source}: expected ${expected}, got ${actual}`);
  };
  expectValue('first == second', 'true');
  expectValue('purse.numberOfObjects', '2');
  expectValue('first.getOneIntersecting<Coin>()?.label ?: "none"', 'second');
  expectValue('first.isTouching<Coin>()', 'true');
  valueOf('purse.removeObject(second)');
  expectValue('purse.allObjects().joinToString { (it as Coin).label }', 'first');
  expectValue('try { second.world; "in a world" } catch (e: Exception) { e.message }', 'The actor is not in a world (add it with addObject first).');
  expectValue('first.world === purse', 'true');
}

// Typed collision queries run inside student actors (they failed at runtime
// while their inlined lambda used an implicit receiver).
const typedSession = api.bluekCreateKotliteSession();
typedSession.configureBluePlay(true, 'native-blueplay-typed-collisions');
expectOk(await awaitCompletion((onInput, onComplete) => typedSession.startLoadProject(['Target.kt', 'Seeker.kt', 'Main.kt'], [
  'class Target : Actor()',
  'class Seeker : Actor() { fun one(): Target? = getOneIntersecting<Target>(); fun touching(): Boolean = isTouching<Target>(); fun count(): Int = getIntersecting<Target>().size; fun clear() { removeTouching<Target>() } }',
  'val typedWorld = World(100, 100, 1); val seeker = Seeker(); val target = Target(); fun main() { typedWorld.addObject(seeker, 10, 10); typedWorld.addObject(target, 10, 10); typedWorld.show() }',
], 'blueplay', 1, onInput, onComplete)), 'typed collision project load');
expectOk(await awaitCompletion((onInput, onComplete) => typedSession.startBluePlayMain(null, onInput, onComplete)), 'typed collision main');
const typedEvaluate = (source, label) => expectOk(JSON.parse(typedSession.evaluate('<typed collisions>', source)), label).display;
if (typedEvaluate('seeker.one() === target && seeker.touching() && seeker.count() == 1', 'typed collision queries') !== 'true') throw new Error('Typed collision queries did not find the touching actor.');
if (typedEvaluate('seeker.clear(); typedWorld.numberOfObjects', 'removeTouching') !== '1') throw new Error('removeTouching did not remove the touching actor.');
if (typedEvaluate('seeker.touching() || seeker.one() != null', 'typed collision after removal') !== 'false') throw new Error('A removed actor was still reported as touching.');

// Standard graphics are usable without being part of the project, and a name
// that exists nowhere fails loudly instead of yielding an invisible placeholder.
const imageSession = api.bluekCreateKotliteSession();
imageSession.configureBluePlay(true, 'native-blueplay-images');
// Project resources are announced last, so a project file wins over the
// standard graphic of the same name.
imageSession.setBluePlayResources(`${standardManifest}\nimages/duck.png\0${3}\0${2}\0${'ff'.repeat(6)}`);
expectOk(await awaitCompletion((onInput, onComplete) => imageSession.startLoadProject(['Main.kt'], ['fun main() { }'], 'blueplay', 1, onInput, onComplete)), 'image project load');
const imageEvaluate = (source) => JSON.parse(imageSession.evaluate('<images>', source));
if (expectOk(imageEvaluate('Image("duck.png").width'), 'standard graphic width').display !== '3')
  throw new Error('A standard graphic was not resolved through the images/ folder.');
if (expectOk(imageEvaluate('Image("images/cat.png").height'), 'standard graphic by path').display !== '30')
  throw new Error('A standard graphic was not resolved by its full path.');
const missingImage = imageEvaluate('Image("duckk.png")');
if (missingImage.kind !== 'error' || !missingImage.display.includes('Image file not found: duckk.png'))
  throw new Error(`A missing image did not report a clear error: ${missingImage.display}`);
if (!missingImage.display.includes('duck.png'))
  throw new Error('The missing-image error does not list the available graphics.');
// A runtime exception faults its session, so the background check runs its own.
const backgroundSession = api.bluekCreateKotliteSession();
backgroundSession.configureBluePlay(true, 'native-blueplay-background');
backgroundSession.setBluePlayResources(standardManifest);
expectOk(await awaitCompletion((onInput, onComplete) => backgroundSession.startLoadProject(['Main.kt'], ['fun main() { }'], 'blueplay', 1, onInput, onComplete)), 'background project load');
expectOk(JSON.parse(backgroundSession.evaluate('<images>', 'World(5, 5, 1).setBackground("pizza.png")')), 'standard background');
const missingBackground = JSON.parse(backgroundSession.evaluate('<images>', 'World(5, 5, 1).setBackground("nope.png")'));
if (missingBackground.kind !== 'error' || !missingBackground.display.includes('Image file not found: nope.png'))
  throw new Error(`A missing background image did not report a clear error: ${missingBackground.display}`);

console.log('BluePlay browser smoke test passed.');
