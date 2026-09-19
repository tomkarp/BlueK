import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundle = await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8');
vm.runInThisContext(bundle, { filename: 'bluek-kotlite-browser.js' });
const api = globalThis['bluek-kotlite-browser'];
const session = api.bluekCreateKotliteSession();
const files = ['Image.kt', 'Actor.kt', 'World.kt', 'BluePlayFunctions.kt', 'Figure.kt', 'MyWorld.kt', 'Main.kt'];
const sources = await Promise.all(files.map(file => readFile(new URL(`../examples/blueplay/${file}`, import.meta.url), 'utf8')));
const staticProject = JSON.parse(await readFile(new URL('../frontend/public/examples/blueplay.bluek.json', import.meta.url), 'utf8'));
const figureResource = staticProject.resources?.find(resource => resource.path === 'images/figure.png');
if (!figureResource?.data?.startsWith('data:image/png;base64,')) throw new Error('The bundled BluePlay example image is missing from the static project asset.');
for (let index = 0; index < files.length; index += 1) {
  if (!staticProject.library && staticProject.files?.find(file => file.fileName === files[index])?.source !== sources[index]) throw new Error(`The bundled BluePlay template is stale for ${files[index]}.`);
}
if (staticProject.library?.id !== 'blueplay' || staticProject.library.version !== 1) throw new Error('The bundled BluePlay example must declare library blueplay v1.');
const expectOk = (json, label) => {
  if (json.kind === 'error') throw new Error(`${label}: ${json.display}`);
  return json;
};
const evaluate = (source, label) => expectOk(JSON.parse(session.evaluate('<BluePlay smoke>', source)), label);

expectOk(JSON.parse(session.load('<BluePlay project>', sources.join('\n\n'))), 'project load');
evaluate('main()', 'main');
const initialStage = JSON.parse(session.takeStage());
if (initialStage.stage.objects[0].x !== 100) throw new Error('BluePlay actor was not placed by main().');
evaluate('step()', 'first step');
const movedStage = JSON.parse(session.takeStage());
if (movedStage.stage.objects[0].x !== 101) throw new Error('Actor act() did not update its position.');
evaluate('start()', 'start');
const runningStage = JSON.parse(session.takeStage());
if (runningStage.stage.running !== true) throw new Error('BluePlay start() did not set running state.');
evaluate('stop()', 'stop');
const stoppedStage = JSON.parse(session.takeStage());
if (stoppedStage.stage.running !== false) throw new Error('BluePlay stop() did not clear running state.');
evaluate('val secondWorld = MyWorld(); val firstActor = Figure(); val secondActor = Figure(); secondWorld.addObject(firstActor, 3, 4); secondWorld.addObject(secondActor, 20, 30); showWorld(secondWorld)', 'multiple actor setup');
const twoActorStage = JSON.parse(session.takeStage());
if (twoActorStage.stage.objects.length !== 2 || twoActorStage.stage.objects[0].x !== 3 || twoActorStage.stage.objects[1].x !== 20) throw new Error('BluePlay did not retain multiple actor instances and positions.');
evaluate('step()', 'multiple actor step');
const twoActorMovedStage = JSON.parse(session.takeStage());
if (twoActorMovedStage.stage.objects[0].x !== 4 || twoActorMovedStage.stage.objects[1].x !== 21) throw new Error('BluePlay did not dispatch act() to every actor.');
evaluate('class CallbackWorld : World(40, 30) { var acts = 0; override fun act() { acts += 1 } }; val callbackWorld = CallbackWorld(); showWorld(callbackWorld); step()', 'world dynamic dispatch');
if (evaluate('callbackWorld.acts', 'world callback result').display !== '1') throw new Error('BluePlay did not dispatch tick() to an overridden student World.act().');
evaluate('callbackWorld.showText("Hallo \\"BlueK\\"", 2, 3); callbackWorld.setBackground("sky.png")', 'world text and background');
const decoratedStage = JSON.parse(session.takeStage());
if (decoratedStage.stage.backgroundPath !== 'sky.png' || decoratedStage.stage.texts[0].text !== 'Hallo "BlueK"' || decoratedStage.stage.texts[0].x !== 2) throw new Error('BluePlay text or background state did not reach the browser stage.');
if (evaluate('callbackWorld.getObjectsAt(0, 0).size', 'world object lookup').display !== '0') throw new Error('BluePlay getObjectsAt returned an actor at the wrong position.');
evaluate('val apiFigure = Figure(); apiFigure.setLocation(4, 5); apiFigure.setRotation(90); apiFigure.move(2)', 'actor convenience API');
if (evaluate('apiFigure.getX()', 'actor x accessor').display !== '4' || evaluate('apiFigure.getY()', 'actor y accessor').display !== '7' || evaluate('apiFigure.getRotation()', 'actor rotation accessor').display !== '90') throw new Error('BluePlay Actor location or rotation API failed.');
if (evaluate('val distanceTarget = Figure(); distanceTarget.setLocation(7, 11); apiFigure.turnTowards(4, 20); apiFigure.getRotation()', 'actor heading API').display !== '90' || evaluate('apiFigure.distanceTo(distanceTarget)', 'actor distance API').display !== '5') throw new Error('BluePlay Actor heading or distance API failed.');
evaluate('apiFigure.setRotation(450); apiFigure.turn(-540)', 'rotation normalization');
if (evaluate('apiFigure.getRotation()', 'normalized rotation').display !== '270') throw new Error('BluePlay Actor rotation was not normalized to 0..359 degrees.');
evaluate('val diagonalActor = Figure(); diagonalActor.setLocation(10, 10); diagonalActor.setRotation(45); diagonalActor.move(10)', 'diagonal actor movement');
if (evaluate('diagonalActor.x', 'diagonal x').display !== '17' || evaluate('diagonalActor.y', 'diagonal y').display !== '17') throw new Error('BluePlay Actor movement did not honor arbitrary headings.');
if (evaluate('callbackWorld.getWidth()', 'world width accessor').display !== '40' || evaluate('callbackWorld.getHeight()', 'world height accessor').display !== '30') throw new Error('BluePlay World dimension API failed.');
evaluate('callbackWorld.setBackground(12, 34, 56)', 'world color background');
const colorStage = JSON.parse(session.takeStage());
if (colorStage.stage.backgroundColor !== 'rgb(12,34,56)') throw new Error('BluePlay color background API failed.');
if (evaluate('callbackWorld.getObjects().size', 'world object list').display !== '0') throw new Error('BluePlay World object list API failed.');
evaluate('val collisionA = Figure(); val collisionB = Figure(); collisionA.setLocation(6, 6); collisionB.setLocation(6, 6)', 'actor collision setup');
if (evaluate('collisionA.intersects(collisionB)', 'actor intersection').display !== 'true' || evaluate('collisionA.isTouching(collisionB)', 'actor touching').display !== 'true') throw new Error('BluePlay actor collision API failed.');
evaluate('val scaledA = Figure(); val scaledB = Figure(); val scaledImage = Image(); scaledImage.scale(10, 10); scaledA.image = scaledImage; scaledB.image = scaledImage; scaledA.setLocation(12, 12); scaledB.setLocation(13, 12)', 'actor overlap setup');
if (evaluate('scaledA.intersects(scaledB)', 'actor bounding-box overlap').display !== 'true') throw new Error('BluePlay collision detection did not account for image dimensions.');
evaluate('val autoWorld = MyWorld(); val autoActor = Figure(); autoWorld.addObject(autoActor, 2, 3); showWorld(autoWorld)', 'automatic add repaint');
const addedStage = JSON.parse(session.takeStage());
if (addedStage.stage.objects.length !== 1 || addedStage.stage.objects[0].x !== 2) throw new Error('Adding an Actor did not update the browser stage.');
if (evaluate('autoWorld.getObjectsAt(2, 3).size', 'world object lookup after add').display !== '1') throw new Error('World.getObjectsAt did not find the actor at its native position.');
evaluate('autoActor.setLocation(3, 4); autoWorld.show()', 'native position lookup');
if (evaluate('autoWorld.getObjectsAt(3, 4).size', 'world object lookup after move').display !== '1') throw new Error('World.getObjectsAt used a stale coordinate mirror.');
const movedActorStage = JSON.parse(session.takeStage());
if (movedActorStage.stage.objects[0]?.x !== 3 || movedActorStage.stage.objects[0]?.y !== 4) throw new Error('Actor property setters did not publish the updated Canvas frame.');
evaluate('autoWorld.addObject(autoActor, -4, 99)', 'clamped actor insertion');
const clampedInsertionStage = JSON.parse(session.takeStage());
if (clampedInsertionStage.stage.objects.some(object => object.x < 0 || object.x >= clampedInsertionStage.stage.width || object.y < 0 || object.y >= clampedInsertionStage.stage.height)) throw new Error('Adding an Actor outside the world bypassed position clamping.');
evaluate('autoWorld.removeObject(autoActor)', 'automatic remove repaint');
const removedStage = JSON.parse(session.takeStage());
if (removedStage.stage.objects.length !== 0) throw new Error('Removing an Actor did not update the browser stage.');
evaluate('autoActor.setLocation(99, 88)', 'detached actor movement');
if (evaluate('autoActor.x', 'detached actor x').display !== '99' || evaluate('autoActor.y', 'detached actor y').display !== '88') throw new Error('Removing an Actor left stale world-boundary clamping behind.');
evaluate('class KeyFigure : Actor() { override fun act() { if (isKeyDown(\"left\")) this.move(-2) } }; val keyWorld = MyWorld(); val keyFigure = KeyFigure(); keyWorld.addObject(keyFigure, 10, 10); showWorld(keyWorld)', 'keyboard setup');
expectOk(JSON.parse(session.setKey('left', true)), 'key down');
evaluate('step()', 'keyboard step');
expectOk(JSON.parse(session.setKey('left', false)), 'key up');
if (JSON.parse(session.evaluate('<BluePlay smoke>', 'keyFigure.x')).display !== '8') throw new Error('BluePlay key state did not reach a student Actor callback.');
if (JSON.parse(session.evaluate('<BluePlay smoke>', 'keyFigure.isAtEdge')).display !== 'false') throw new Error('BluePlay incorrectly reported an interior Actor at the edge.');
evaluate('keyFigure.x = 0', 'edge setup');
if (JSON.parse(session.evaluate('<BluePlay smoke>', 'keyFigure.isAtEdge')).display !== 'true') throw new Error('BluePlay did not report an Actor at the world edge.');
evaluate('keyFigure.move(-2)', 'edge clamping');
if (JSON.parse(session.evaluate('<BluePlay smoke>', 'keyFigure.x')).display !== '0') throw new Error('BluePlay allowed an Actor to move outside the world.');
evaluate('firstActor.setImage("hero.png"); secondWorld.background = Image("sky.png"); playSound("step.wav"); showWorld(secondWorld)', 'media bridge');
const mediaStage = JSON.parse(session.takeStage());
if (mediaStage.stage.objects[0].imagePath !== 'hero.png' || mediaStage.stage.backgroundPath !== 'sky.png') throw new Error('BluePlay media paths did not reach the browser stage.');
if (!mediaStage.stage.sounds || mediaStage.stage.sounds[0] !== 'step.wav') throw new Error('BluePlay sound event did not reach the browser stage.');
evaluate('val painted = Image(); painted.scale(40, 50); painted.setColor(12, 34, 56); painted.fillRect(1, 2, 3, 4); painted.drawLine(0, 0, 5, 6); painted.drawString("A|B", 2, 3); painted.drawImage(painted, 8, 9); painted.setTransparency(128); firstActor.image = painted; secondWorld.background = painted; showWorld(secondWorld)', 'drawable image bridge');
const drawnStage = JSON.parse(session.takeStage());
const drawnActor = drawnStage.stage.objects.find(object => object.imageOperations?.length);
if (!drawnActor || !drawnActor.imageOperations.some(operation => operation.startsWith('fillRect|1|2|3|4|rgb(12,34,56)')) || !drawnActor.imageOperations.some(operation => operation.startsWith('drawLine|0|0|5|6|rgb(12,34,56)')) || !drawnActor.imageOperations.some(operation => operation.startsWith('drawString|A\\pB|2|3|rgb(12,34,56)')) || !drawnActor.imageOperations.some(operation => operation.startsWith('drawImage|__bluek:'))) throw new Error('BluePlay Image drawing operations did not reach the browser stage.');
const nestedOperation = drawnActor.imageOperations.find(operation => operation.startsWith('drawImage|__bluek:'));
const nestedPayload = nestedOperation?.match(/^drawImage\|__bluek:(.*)\|8\|9\|40\|50$/)?.[1];
if (!nestedPayload) throw new Error('Nested BluePlay image operation could not be isolated.');
let nestedImage;
try {
  let decoded = '';
  for (let index = 0; index < nestedPayload.length; index += 1) {
    const character = nestedPayload[index];
    if (character !== '\\' || index + 1 >= nestedPayload.length) { decoded += character; continue; }
    const escaped = nestedPayload[++index];
    decoded += escaped === '\\' ? '\\' : escaped === '"' ? '"' : escaped === 'p' ? '|' : escaped === 'n' ? '\n' : `\\${escaped}`;
  }
  nestedImage = JSON.parse(decoded);
} catch { nestedImage = null; }
if (!nestedImage?.operations?.some(operation => operation.startsWith('drawString|A\\pB|2|3|rgb(12,34,56)'))) throw new Error('Nested BluePlay image escaping could not be decoded for browser rendering.');
if (drawnActor.imageWidth !== 40 || drawnActor.imageHeight !== 50 || drawnActor.imageOpacity !== 128 / 255 || !drawnStage.stage.backgroundOperations?.length) throw new Error('BluePlay Image scale, transparency or background drawing state was lost.');
evaluate('val clickedActor = Figure(); val clickedWorld = MyWorld(); clickedWorld.addObject(clickedActor, 7, 9)', 'click setup');
expectOk(JSON.parse(session.setClick(7, 9, '')), 'actor click');
if (evaluate('clickedActor.isClicked', 'actor click query').display !== 'true') throw new Error('BluePlay actor click was not delivered to the student object.');
expectOk(JSON.parse(session.setClick(12, 13, '')), 'world click');
if (evaluate('clickedWorld.isClicked', 'world click query').display !== 'true') throw new Error('BluePlay world click was not delivered to the student object.');

// Native library path: only student files are sent to the session, while the
// built-in World/Actor/Image/Functions declarations come from the runtime.
const nativeSession = api.bluekCreateKotliteSession();
nativeSession.configureBluePlay(true, 'native-blueplay-smoke');
const nativeFiles = ['Figure.kt', 'MyWorld.kt', 'Main.kt'];
const nativeSources = await Promise.all(nativeFiles.map(file => readFile(new URL(`../examples/blueplay/${file}`, import.meta.url), 'utf8')));
const awaitCompletion = (start) => new Promise(resolve => {
  const started = JSON.parse(start(() => {}, value => resolve(JSON.parse(value))));
  if (started.kind === 'error') resolve(started);
});
const nativeLoad = await awaitCompletion((onInput, onComplete) => nativeSession.startLoadProject(nativeFiles, nativeSources, 'blueplay', 1, onInput, onComplete));
expectOk(nativeLoad, 'native project load');
expectOk(await awaitCompletion((onInput, onComplete) => nativeSession.startBluePlayMain(onInput, onComplete)), 'native main');
const nativeInitial = JSON.parse(nativeSession.takeStage()).stage;
if (nativeInitial.objects[0]?.x !== 100) throw new Error('Native BluePlay library did not render the actor from main().');
expectOk(await awaitCompletion((onInput, onComplete) => nativeSession.startBluePlayStep(onInput, onComplete)), 'native step');
const nativeMoved = JSON.parse(nativeSession.takeStage()).stage;
if (nativeMoved.objects[0]?.x !== 101) throw new Error('Native BluePlay scheduler did not dispatch Actor.act().');

// A click targets the visible actor identity, not merely its centre cell. The
// actor may safely remove itself while the scheduler is iterating the frame.
const removalSession = api.bluekCreateKotliteSession();
removalSession.configureBluePlay(true, 'native-blueplay-removal');
removalSession.setBluePlayResources(`images/mask.png\0${4}\0${4}\0${'ff'.repeat(16)}`);
const removalFiles = ['RemovingActor.kt', 'Main.kt'];
const removalSources = [
  'class RemovingActor : Actor() { init { setImage("mask.png") }; override fun act() { if (isClicked) world.removeObject(this) } }',
  'val removalWorld = World(30, 20, 1); val removalActor = RemovingActor(); val secondRemovalActor = RemovingActor(); fun main() { removalWorld.addObject(removalActor, 10, 10); removalWorld.addObject(secondRemovalActor, 20, 10); showWorld(removalWorld) }',
];
expectOk(await awaitCompletion((onInput, onComplete) => removalSession.startLoadProject(removalFiles, removalSources, 'blueplay', 1, onInput, onComplete)), 'self-removal project load');
expectOk(await awaitCompletion((onInput, onComplete) => removalSession.startBluePlayMain(onInput, onComplete)), 'self-removal main');
const removableStage = JSON.parse(removalSession.takeStage()).stage;
if (removableStage.objects.length !== 2 || removableStage.objects[0]?.image.width !== 4 || !removableStage.objects[0]?.hitId || !removableStage.objects[1]?.hitId) throw new Error('Runtime image metadata or stable hit identity is missing.');
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

// Bounding boxes overlap here, but only the left source column is opaque. The
// actors touch only after they share the same visible pixels.
const collisionSession = api.bluekCreateKotliteSession();
collisionSession.configureBluePlay(true, 'native-blueplay-alpha-collision');
collisionSession.setBluePlayResources(`images/mask.png\0${4}\0${4}\0${'ff000000'.repeat(4)}`);
const collisionFiles = ['MaskActor.kt', 'Collision.kt'];
const collisionSources = [
  'class MaskActor : Actor() { init { setImage("mask.png") } }',
  'val pixelWorld = World(30, 20, 1); val pixelA = MaskActor(); val pixelB = MaskActor(); fun main() { pixelWorld.addObject(pixelA, 10, 10); pixelWorld.addObject(pixelB, 11, 10); showWorld(pixelWorld) }',
];
expectOk(await awaitCompletion((onInput, onComplete) => collisionSession.startLoadProject(collisionFiles, collisionSources, 'blueplay', 1, onInput, onComplete)), 'alpha collision project load');
expectOk(await awaitCompletion((onInput, onComplete) => collisionSession.startBluePlayMain(onInput, onComplete)), 'alpha collision main');
const collisionEvaluate = (source, label) => expectOk(JSON.parse(collisionSession.evaluate('<BluePlay alpha smoke>', source)), label);
if (collisionEvaluate('pixelA.isTouching(pixelB)', 'transparent overlap').display !== 'false') throw new Error('Transparent source pixels incorrectly triggered isTouching.');
collisionEvaluate('pixelB.x = 10', 'opaque overlap setup');
collisionEvaluate('pixelB.rotation = 180', 'rotated transparent overlap setup');
if (collisionEvaluate('pixelA.isTouching(pixelB)', 'rotated transparent overlap').display !== 'false') throw new Error('Rotated transparent pixels incorrectly triggered isTouching.');
collisionEvaluate('pixelB.rotation = 0', 'visible overlap setup');
if (collisionEvaluate('pixelA.isTouching(pixelB)', 'opaque overlap').display !== 'true') throw new Error('Visible source pixels did not trigger isTouching.');

console.log('BluePlay browser smoke test passed.');
