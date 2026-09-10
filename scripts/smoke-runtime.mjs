import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const base = 'http://127.0.0.1:5174';
const server = spawn('node', ['server/dist/server/src/index.js'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BLUEK_PORT: '5174', BLUEK_ACTION_TIMEOUT_MS: '10000' } });
let output = '';
server.stdout.on('data', chunk => { output += chunk.toString(); });
server.stderr.on('data', chunk => { output += chunk.toString(); });
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const json = async (url, options) => {
  try {
    const response = await fetch(`${base}${url}`, options);
    const text = await response.text();
    let body = {};
    if (text) {
      try { body = JSON.parse(text); } catch { body = { text }; }
    }
    return { response, body };
  } catch (error) {
    throw new Error(`request ${url} failed: ${error.message}\nServer output:\n${output}`, { cause: error });
  }
};
const post = (url, body) => json(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

try {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(`${base}/api/examples`)).ok) break; } catch { /* server is still starting */ }
    if (attempt === 99) throw new Error(`Smoke server did not become ready.\nServer output:\n${output}`);
    await wait(100);
  }
  const session = (await post('/api/session', {})).body;
  const invalidFiles = await post(`/api/session/${session.sessionId}/compile`, { files: [{ fileName: '../escape.kt', source: 'class Escape', kind: 'class' }], revision: 1 });
  assert.equal(invalidFiles.response.status, 400);
  const duplicateFiles = await post(`/api/session/${session.sessionId}/compile`, { files: [{ fileName: 'Same.kt', source: 'class Same', kind: 'class' }, { fileName: 'Same.kt', source: 'class Same', kind: 'class' }], revision: 1 });
  assert.equal(duplicateFiles.response.status, 400);
  const mixedFile = await post(`/api/session/${session.sessionId}/compile`, { files: [{ fileName: 'Mixed.kt', source: 'class Mixed\nfun helper() = 1', kind: 'class' }], revision: 1 });
  assert.equal(mixedFile.response.status, 200);
  assert.match(mixedFile.body.diagnostics[0].message, /BlueK class files/);
  const mismatchedName = await post(`/api/session/${session.sessionId}/compile`, { files: [{ fileName: 'Person.kt', source: 'class Student', kind: 'class' }], revision: 1 });
  assert.equal(mismatchedName.response.status, 200);
  assert.match(mismatchedName.body.diagnostics[0].message, /file names must match/);
  const syntaxError = await post(`/api/session/${session.sessionId}/compile`, { files: [{ fileName: 'Broken.kt', source: 'class Broken(', kind: 'class' }], revision: 1 });
  assert.equal(syntaxError.response.status, 200);
  assert.ok(syntaxError.body.diagnostics.some(diagnostic => diagnostic.fileName === 'Broken.kt' && diagnostic.line >= 1 && diagnostic.column >= 1));
  assert.equal((await json(`/api/session/${session.sessionId}/status`)).body.workerAlive, true);
  const files = [
    { id: 'counter', fileName: 'Counter.kt', kind: 'class', revision: 1, source: 'class Counter(var value: Int = 0) { fun increment() { value++ }; fun add(amount: Int) { value += amount }; fun current(): Int = value }' },
    { id: 'person', fileName: 'Person.kt', kind: 'class', revision: 1, source: 'class Person(var name: String, var isReady: Boolean = false) { fun greet(): String = "Hello, $name!"; fun localValue(): String { fun hidden() = "hidden"\nval local: String = "local"; return local }; fun rename(newName: String) { name = newName }; fun greetInConsole() { Thread.sleep(200); println(greet() + "\\t✓"); Thread.sleep(1500); System.err.println("warning"); System.err.flush() }; fun greetWith(prefix: String = "Hi", suffix: String): String = "$prefix $name$suffix"; fun friend(): Person = Person("$name Jr") }' },
    { id: 'helpers', fileName: 'Helpers.kt', kind: 'functions', revision: 1, source: 'fun square(x: Int): Int = x * x; fun askName(): String { println("What is your name?"); val name = readln(); println("Hello, $name!"); return name }; fun noisyInput(): String { System.err.println("warning"); System.err.flush(); return readln() }' },
    { id: 'box', fileName: 'Box.kt', kind: 'class', revision: 1, source: 'class Box<T>(var value: T) { fun replace(next: T) { value = next }; fun get(): T = value }' },
    { id: 'bounded', fileName: 'Bounded.kt', kind: 'class', revision: 1, source: 'class Bounded<T : Number>(val value: T) { fun get(): T = value }' },
    { id: 'typed', fileName: 'Typed.kt', kind: 'class', revision: 1, source: 'class Typed(val value: Map<String, List<Int>?>, val sink: MutableList<in Number>)' },
    { id: 'nested', fileName: 'Nested.kt', kind: 'class', revision: 1, source: 'class Nested(val values: List<Map<String, Int>> = emptyList())' },
    { id: 'lambda', fileName: 'LambdaBox.kt', kind: 'class', revision: 1, source: 'class LambdaBox(val transform: (Int, Int) -> String = { a, b -> "$a,$b" })' },
    { id: 'private-ctor', fileName: 'PrivateCtor.kt', kind: 'class', revision: 1, source: 'class PrivateCtor private constructor(val value: Int)' },
    { id: 'callbacks', fileName: 'Callbacks.kt', kind: 'class', revision: 1, source: 'class Callbacks { fun transform(block: (Int) -> String): String = block(3) }' },
    { id: 'overloaded', fileName: 'Overloaded.kt', kind: 'class', revision: 1, source: 'class Overloaded { val kind: String; constructor(value: Int) { kind = "int" }; constructor(value: String) { kind = "string" } }' },
    { id: 'base', fileName: 'Base.kt', kind: 'class', revision: 1, source: 'open class Base(var baseValue: String)' },
    { id: 'child', fileName: 'Child.kt', kind: 'class', revision: 1, source: 'class Child(baseValue: String): Base(baseValue) { var ownValue: Int = 7 }' },
    { id: 'tools', fileName: 'Tools.kt', kind: 'class', revision: 1, source: 'object Tools { fun twice(value: Int): Int = value * 2; fun ping() { println("pong") } }' },
    { id: 'factory', fileName: 'Factory.kt', kind: 'class', revision: 1, source: 'class Factory { companion object { fun make(value: Int): Counter = Counter(value) } }' },
    { id: 'abstract', fileName: 'AbstractThing.kt', kind: 'class', revision: 1, source: 'abstract class AbstractThing { fun ping() {} }' },
    { id: 'color', fileName: 'Color.kt', kind: 'class', revision: 1, source: 'enum class Color { RED, BLUE }' },
    { id: 'tag', fileName: 'Tag.kt', kind: 'class', revision: 1, source: 'annotation class Tag(val value: String)' },
    { id: 'comments', fileName: 'Commented.kt', kind: 'class', revision: 1, source: '// class that should not become metadata\nclass Commented { val text: String = "object fake" }' },
    { id: 'world', fileName: 'World.kt', kind: 'class', revision: 1, source: 'open class World(val width: Int, val height: Int, val cellSize: Int) { private val actors = mutableListOf<Actor>(); var background: Image = Image(width * cellSize, height * cellSize); val isClicked: Boolean get() = isWorldClicked(); fun addObject(actor: Actor, x: Int, y: Int) { actors.add(actor); actor.x = x; actor.y = y; setWorldOf(actor, this) }; fun allObjects(): List<Actor> = actors.toList(); fun show() { showWorld(this) }; fun showText(text: String, x: Int, y: Int) { setTextOf(this, x, y, text) }; fun clicked(): Boolean = isClicked; open fun act() {} }' },
    { id: 'actor', fileName: 'Actor.kt', kind: 'class', revision: 1, source: 'open class Actor { var x: Int = 0; var y: Int = 0; var rotation: Int = 0; var image: Image? = null; val isClicked: Boolean get() = isActorClicked(this); open fun act() {}; fun move(distance: Int) { x += distance }; fun clicked(): Boolean = isClicked }' },
    { id: 'image', fileName: 'Image.kt', kind: 'class', revision: 1, source: 'import java.awt.Color\nimport java.awt.image.BufferedImage\nclass Image { var awtImage: BufferedImage; var color: Color = Color.BLACK; @get:JvmSynthetic @set:JvmSynthetic internal var transparency: Int = 255; constructor(width: Int, height: Int) { awtImage = BufferedImage(maxOf(1, width), maxOf(1, height), BufferedImage.TYPE_INT_ARGB) }; constructor(fileName: String) { awtImage = cachedImage(fileName) }; val width: Int get() = awtImage.width; val height: Int get() = awtImage.height; fun setColor(r: Int, g: Int, b: Int) { color = Color(r, g, b) }; fun fill() { val g = awtImage.createGraphics(); g.color = color; g.fillRect(0, 0, width, height); g.dispose() }; fun scale(nextWidth: Int, nextHeight: Int) { awtImage = BufferedImage(maxOf(1, nextWidth), maxOf(1, nextHeight), BufferedImage.TYPE_INT_ARGB) }; fun setTransparency(value: Int) { transparency = value.coerceIn(0, 255) } }' },
    { id: 'walker', fileName: 'Walker.kt', kind: 'class', revision: 1, source: 'class Walker: Actor() { init { image = Image(20, 20) }; override fun act() { move(1) } }' },
    { id: 'textured', fileName: 'Textured.kt', kind: 'class', revision: 1, source: 'class Textured: Actor() { init { image = Image("hero.png") } }' },
    { id: 'broken', fileName: 'Broken.kt', kind: 'class', revision: 1, source: 'class Broken: Actor() { override fun act() { error("boom") } }' },
    { id: 'blueplay', fileName: 'BluePlayFunctions.kt', kind: 'functions', revision: 1, source: '// replaced by the headless BluePlay adapter' },
  ];
  const compiled = await post(`/api/session/${session.sessionId}/compile`, { files, resources: [{ path: 'images/hero.png', data: `data:image/png;base64,${onePixelPng}` }], revision: 1 });
  assert.equal(compiled.body.diagnostics.length, 0, JSON.stringify(compiled.body.diagnostics));
  assert.equal(compiled.body.classes.find(value => value.name === 'Overloaded').constructors.length, 2);
  assert.equal(compiled.body.classes.find(value => value.name === 'Person').methods.find(value => value.name === 'greet').parameters.length, 0);
  assert.equal(compiled.body.classes.find(value => value.name === 'Person').methods.some(value => value.name === 'hidden'), false);
  assert.equal(compiled.body.classes.find(value => value.name === 'Helpers').kind, 'functions');
  assert.equal(compiled.body.classes.find(value => value.name === 'Helpers').methods.find(value => value.name === 'square').parameters.length, 1);
  assert.equal(compiled.body.classes.find(value => value.name === 'Nested').constructors[0].parameters[0].type.displayName, 'List<Map<String, Int>>');
  assert.equal(compiled.body.classes.find(value => value.name === 'Nested').constructors[0].parameters[0].hasDefault, true);
  assert.equal(compiled.body.classes.find(value => value.name === 'LambdaBox').constructors[0].parameters.length, 1);
  assert.equal(compiled.body.classes.find(value => value.name === 'LambdaBox').constructors[0].parameters[0].type.displayName, '(Int, Int) -> String');
  assert.equal(compiled.body.classes.find(value => value.name === 'PrivateCtor').constructors.length, 0);
  assert.equal(compiled.body.classes.find(value => value.name === 'Tools').kind, 'object');
  assert.equal(compiled.body.classes.find(value => value.name === 'Tools').constructors.length, 0);
  assert.equal(compiled.body.classes.find(value => value.name === 'Factory').companionMethods.find(value => value.name === 'make').parameters.length, 1);
  assert.equal(compiled.body.classes.find(value => value.name === 'Factory').methods.some(value => value.name === 'make'), false);
  assert.equal(compiled.body.classes.find(value => value.name === 'AbstractThing').kind, 'abstract');
  assert.equal(compiled.body.classes.find(value => value.name === 'AbstractThing').constructors.length, 0);
  assert.equal(compiled.body.classes.find(value => value.name === 'Color').kind, 'enum');
  assert.equal(compiled.body.classes.find(value => value.name === 'Color').constructors.length, 0);
  assert.equal(compiled.body.classes.find(value => value.name === 'Tag').kind, 'annotation');
  assert.equal(compiled.body.classes.find(value => value.name === 'Tag').constructors.length, 0);
  assert.equal(compiled.body.classes.some(value => value.name === 'that'), false);
  assert.ok(compiled.body.classes.some(value => value.name === 'Commented'));
  assert.deepEqual(compiled.body.classes.find(value => value.name === 'Bounded').typeParameters, ['T : Number']);
  assert.equal(compiled.body.classes.find(value => value.name === 'Bounded').constructors[0].parameters[0].type.displayName, 'T');
  const typedConstructor = compiled.body.classes.find(value => value.name === 'Typed').constructors[0];
  assert.deepEqual(typedConstructor.parameters[0].type.arguments.map(value => value.displayName), ['String', 'List<Int>?']);
  assert.equal(typedConstructor.parameters[0].type.arguments[1].arguments[0].displayName, 'Int');
  assert.equal(typedConstructor.parameters[1].type.arguments[0].projection, 'in');
  const callbackMethod = compiled.body.classes.find(value => value.name === 'Callbacks').methods.find(value => value.name === 'transform');
  assert.equal(callbackMethod.parameters[0].type.displayName, '(Int) -> String');
  assert.deepEqual(compiled.body.classes.find(value => value.name === 'Person').properties.map(value => value.name), ['name', 'isReady']);
  assert.equal(compiled.body.classes.find(value => value.name === 'Person').properties[0].mutable, true);
  assert.ok(compiled.body.classes.find(value => value.name === 'Person').methods.some(value => value.name === 'getName' && value.autoGenerated));
  assert.ok(compiled.body.classes.find(value => value.name === 'Person').methods.some(value => value.name === 'setName' && value.autoGenerated));
  assert.ok(compiled.body.classes.find(value => value.name === 'Person').methods.some(value => value.name === 'isReady' && value.autoGenerated));
  assert.ok(compiled.body.classes.find(value => value.name === 'Person').methods.some(value => value.name === 'setReady' && value.autoGenerated));
  const generationId = compiled.body.generationId;
  assert.deepEqual((await json(`/api/session/${session.sessionId}/status`)).body, { workerAlive: true, generationId, available: true, error: null });
  const action = body => post(`/api/session/${session.sessionId}/action`, { ...body, generationId });
  const counter = (await action({ op: 'create', className: 'Counter', name: 'counter1', args: JSON.stringify(['3']) })).body;
  assert.ok(counter.objectId, JSON.stringify(counter));
  const duplicateCounter = await action({ op: 'create', className: 'Counter', name: 'counter1', args: '[]' });
  assert.equal(duplicateCounter.body.kind, 'error');
  assert.equal((await action({ op: 'invoke', objectId: counter.objectId, name: 'current', args: '[]' })).body.display, '3');
  const incremented = await action({ op: 'invoke', objectId: counter.objectId, name: 'increment', args: '[]' });
  assert.equal(incremented.body.kind, 'unit', JSON.stringify(incremented));
  await action({ op: 'invoke', objectId: counter.objectId, name: 'add', args: JSON.stringify(['5']) });
  assert.equal((await action({ op: 'invoke', objectId: counter.objectId, name: 'current', args: '[]' })).body.display, '9');
  const counterInspection = (await action({ op: 'inspect', objectId: counter.objectId })).body;
  assert.match(counterInspection.display, /value=9/);
  assert.deepEqual(counterInspection.fields.find(field => field.name === 'value').display, '9');
  const person = (await action({ op: 'create', className: 'Person', name: 'person1', args: JSON.stringify(['"Ada"']) })).body;
  assert.equal((await action({ op: 'invoke', objectId: person.objectId, name: 'greet', args: '[]' })).body.display, 'Hello, Ada!');
  assert.equal((await action({ op: 'eval', code: 'person1.name', mode: 'expression' })).body.display, 'Ada');
  assert.equal((await action({ op: 'eval', code: 'person1.name = "Bea"', mode: 'block' })).body.kind, 'unit');
  assert.equal((await action({ op: 'eval', code: 'person1.name', mode: 'expression' })).body.display, 'Bea');
  await action({ op: 'eval', code: 'person1.name = "Ada"', mode: 'block' });
  const emptyNamePerson = (await action({ op: 'create', className: 'Person', name: 'emptyName', args: JSON.stringify(['""']) })).body;
  assert.equal((await action({ op: 'invoke', objectId: emptyNamePerson.objectId, name: 'greet', args: '[]' })).body.display, 'Hello, !');
  const callbacks = (await action({ op: 'create', className: 'Callbacks', name: 'callbacks1', args: '[]' })).body;
  assert.equal((await action({ op: 'invoke', objectId: callbacks.objectId, name: 'transform', args: JSON.stringify(['{ value: Int -> value.toString() }']) })).body.display, '3');
  assert.equal((await action({ op: 'invoke', objectId: person.objectId, name: 'greetWith', args: JSON.stringify(['suffix = "!"']) })).body.display, 'Hi Ada!');
  const consoleRequest = action({ op: 'invoke', objectId: person.objectId, name: 'greetInConsole', args: '[]' });
  let consoleEvents = [];
  for (let attempt = 0; attempt < 60 && (!consoleEvents.some(event => event.stream === 'stdout') || !consoleEvents.some(event => event.stream === 'stderr')); attempt += 1) {
    await wait(100);
    consoleEvents.push(...(await json(`/api/session/${session.sessionId}/events`)).body);
  }
  const consoleResult = await consoleRequest;
  assert.equal(consoleResult.body.output, 'Hello, Ada!\t✓\nwarning\n', JSON.stringify(consoleResult));
  assert.ok(consoleEvents.some(event => event.stream === 'stdout' && event.output.includes('Hello, Ada!')), JSON.stringify(consoleEvents));
  const noisyRequest = action({ op: 'eval', code: 'noisyInput()', mode: 'expression' });
  let noisyEvents = [];
  for (let attempt = 0; attempt < 30 && !noisyEvents.some(event => event.stream === 'stderr'); attempt += 1) {
    await wait(100);
    noisyEvents.push(...(await json(`/api/session/${session.sessionId}/events`)).body);
  }
  assert.ok(noisyEvents.some(event => event.stream === 'stderr' && event.output.includes('warning')), JSON.stringify(noisyEvents));
  assert.equal((await post(`/api/session/${session.sessionId}/input`, { text: 'done' })).response.status, 202);
  assert.equal((await noisyRequest).body.display, 'done');
  const friend = (await action({ op: 'invoke', objectId: person.objectId, name: 'friend', args: '[]' })).body;
  assert.equal(friend.kind, 'object');
  assert.ok(friend.objectId);
  assert.match((await action({ op: 'inspect', objectId: friend.objectId })).body.display, /name="Ada Jr"/);
  assert.equal((await action({ op: 'invoke', objectId: friend.objectId, name: 'greet', args: '[]' })).body.display, 'Hello, Ada Jr!');
  assert.equal((await action({ op: 'eval', code: 'val codepadPerson = Person("Codepad")', mode: 'block' })).body.kind, 'unit');
  assert.equal((await action({ op: 'eval', code: 'codepadPerson.greet()', mode: 'expression' })).body.display, 'Hello, Codepad!');
  assert.equal((await action({ op: 'eval', code: 'var codepadNumber = 1', mode: 'block' })).body.kind, 'unit');
  const updatedCodepadNumber = (await action({ op: 'eval', code: 'codepadNumber = 2', mode: 'block' })).body;
  assert.equal(updatedCodepadNumber.kind, 'unit', updatedCodepadNumber.display);
  assert.equal((await action({ op: 'eval', code: 'codepadNumber', mode: 'expression' })).body.display, '2');
  assert.equal((await action({ op: 'eval', code: 'val alias = person1', mode: 'block' })).body.kind, 'unit');
  assert.equal((await action({ op: 'eval', code: 'alias.rename("Aliased")', mode: 'expression' })).body.kind, 'unit');
  assert.match((await action({ op: 'inspect', objectId: person.objectId })).body.display, /name="Aliased"/);
  assert.equal((await action({ op: 'eval', code: 'val typedBox: Box<String> = Box("Ada")', mode: 'block' })).body.kind, 'unit');
  assert.equal((await action({ op: 'eval', code: 'typedBox.get()', mode: 'expression' })).body.display, 'Ada');
  assert.equal((await action({ op: 'eval', code: 'typedBox.replace(42)', mode: 'expression' })).body.kind, 'error');
  assert.equal((await action({ op: 'eval', code: 'var optionalName: String? = null', mode: 'block' })).body.kind, 'unit');
  assert.equal((await action({ op: 'eval', code: 'optionalName == null', mode: 'expression' })).body.display, 'true');
  const waiting = action({ op: 'eval', code: 'askName()', mode: 'expression' });
  const liveEvents = [];
  for (let attempt = 0; attempt < 30 && !liveEvents.some(event => event.output?.includes('What is your name?')); attempt++) {
    await wait(500);
    liveEvents.push(...(await json(`/api/session/${session.sessionId}/events`)).body);
  }
  assert.match(liveEvents.map(event => event.output || '').join(''), /What is your name\?/);
  assert.equal((await post(`/api/session/${session.sessionId}/input`, { text: '' })).response.status, 202);
  assert.equal((await waiting).body.display, '');
  const namedInput = action({ op: 'eval', code: 'askName()', mode: 'expression' });
  let namedEvents = [];
  for (let attempt = 0; attempt < 30 && !namedEvents.some(event => event.output?.includes('What is your name?')); attempt++) {
    await wait(500);
    namedEvents.push(...(await json(`/api/session/${session.sessionId}/events`)).body);
  }
  assert.match(namedEvents.map(event => event.output || '').join(''), /What is your name\?/);
  assert.equal((await post(`/api/session/${session.sessionId}/input`, { text: 'Ada' })).response.status, 202);
  const namedResult = await namedInput;
  assert.equal(namedResult.body.display, 'Ada');
  assert.match(namedResult.body.output, /Hello, Ada!/);
  assert.equal((await action({ op: 'eval', code: 'square(7)', mode: 'expression' })).body.display, '49');
  const hugeOutput = (await action({ op: 'eval', code: 'repeat(200000) { print("1234567890") }', mode: 'block' })).body;
  assert.equal(hugeOutput.kind, 'unit');
  assert.ok(hugeOutput.output.length <= 1_000_100, `output limit not applied: ${hugeOutput.output.length}`);
  assert.match(hugeOutput.output, /output truncated after 1000000 characters/);
  assert.equal((await action({ op: 'eval', code: 'Tools.twice(7)', mode: 'expression' })).body.display, '14');
  const made = (await action({ op: 'eval', code: 'Factory.make(8)', mode: 'expression' })).body;
  assert.equal(made.kind, 'object');
  assert.match((await action({ op: 'inspect', objectId: made.objectId })).body.display, /value=8/);
  const world = (await action({ op: 'create', className: 'World', name: 'world1', args: JSON.stringify(['20', '10', '1']) })).body;
  const secondWorld = (await action({ op: 'create', className: 'World', name: 'world2', args: JSON.stringify(['4', '3', '1']) })).body;
  assert.equal((await action({ op: 'invoke', objectId: secondWorld.objectId, name: 'show', args: '[]' })).body.kind, 'unit');
  assert.equal((await json(`/api/session/${session.sessionId}/stage`)).body.stage.width, 4);
  assert.equal((await action({ op: 'invoke', objectId: world.objectId, name: 'show', args: '[]' })).body.kind, 'unit');
  const walker = (await action({ op: 'create', className: 'Walker', name: 'walker1', args: '[]' })).body;
  const textured = (await action({ op: 'create', className: 'Textured', name: 'textured1', args: '[]' })).body;
  assert.equal((await action({ op: 'invoke', objectId: world.objectId, name: 'addObject', args: JSON.stringify(['walker1', '2', '3']) })).body.kind, 'unit');
  assert.equal((await action({ op: 'invoke', objectId: world.objectId, name: 'addObject', args: JSON.stringify(['textured1', '5', '4']) })).body.kind, 'unit');
  assert.equal((await action({ op: 'invoke', objectId: world.objectId, name: 'show', args: '[]' })).body.kind, 'unit');
  assert.equal((await action({ op: 'eval', code: 'setSpeed(80)', mode: 'expression' })).body.kind, 'unit');
  assert.equal((await action({ op: 'eval', code: 'getSpeed()', mode: 'expression' })).body.display, '80');
  assert.equal((await action({ op: 'eval', code: 'setSpeed(1000)', mode: 'expression' })).body.kind, 'unit');
  assert.equal((await action({ op: 'eval', code: 'getSpeed()', mode: 'expression' })).body.display, '100');
  assert.equal((await post(`/api/session/${session.sessionId}/key`, { key: 'left', pressed: true })).response.status, 202);
  assert.equal((await action({ op: 'eval', code: 'isKeyDown("left")', mode: 'expression' })).body.display, 'true');
  assert.equal((await post(`/api/session/${session.sessionId}/key`, { key: 'left', pressed: false })).response.status, 202);
  assert.equal((await action({ op: 'eval', code: 'isKeyDown("left")', mode: 'expression' })).body.display, 'false');
  assert.equal((await post(`/api/session/${session.sessionId}/click`, { x: 3, y: 3 })).response.status, 202);
  assert.equal((await action({ op: 'invoke', objectId: walker.objectId, name: 'clicked', args: '[]' })).body.display, 'true');
  assert.equal((await post(`/api/session/${session.sessionId}/click`, { x: 18, y: 8 })).response.status, 202);
  assert.equal((await action({ op: 'invoke', objectId: world.objectId, name: 'clicked', args: '[]' })).body.display, 'true');
  assert.equal((await action({ op: 'eval', code: 'start()', mode: 'expression' })).body.kind, 'unit');
  await wait(120);
  const movingStage = (await json(`/api/session/${session.sessionId}/stage`)).body.stage;
  assert.equal(movingStage.running, true);
  assert.ok(movingStage.objects.find(value => value.type === 'Walker').x > 2);
  assert.equal(movingStage.objects.find(value => value.type === 'Walker').imageWidth, 20);
  assert.equal(movingStage.objects.find(value => value.type === 'Walker').imageHeight, 20);
  assert.equal(movingStage.objects.find(value => value.type === 'Textured').imageWidth, 1);
  assert.equal((await action({ op: 'eval', code: 'stop()', mode: 'expression' })).body.kind, 'unit');
  const stoppedX = (await json(`/api/session/${session.sessionId}/stage`)).body.stage.objects.find(value => value.type === 'Walker').x;
  assert.equal((await json(`/api/session/${session.sessionId}/stage`)).body.stage.running, false);
  await wait(80);
  assert.equal((await json(`/api/session/${session.sessionId}/stage`)).body.stage.objects.find(value => value.type === 'Walker').x, stoppedX);
  const broken = (await action({ op: 'create', className: 'Broken', name: 'broken1', args: '[]' })).body;
  assert.equal((await action({ op: 'invoke', objectId: world.objectId, name: 'addObject', args: JSON.stringify(['broken1', '4', '3']) })).body.kind, 'unit');
  const brokenStart = await action({ op: 'eval', code: 'start()', mode: 'expression' });
  assert.equal(brokenStart.body.kind, 'unit');
  let simulationErrors = (brokenStart.body.stage?.errors || []).join('\n');
  for (let attempt = 0; attempt < 10 && !simulationErrors.includes('boom'); attempt++) {
    await wait(40);
    const brokenStage = await json(`/api/session/${session.sessionId}/stage`);
    assert.ok(brokenStage.body.stage, JSON.stringify(brokenStage));
    assert.ok(Array.isArray(brokenStage.body.stage.errors), JSON.stringify(brokenStage));
    simulationErrors += brokenStage.body.stage.errors.join('\n');
  }
  assert.match(simulationErrors, /boom/);
  assert.equal((await action({ op: 'eval', code: 'error("Demo")', mode: 'expression' })).body.kind, 'error');
  assert.equal((await action({ op: 'eval', code: 'square(7)', mode: 'expression' })).body.display, '49');
  const box = (await action({ op: 'create', className: 'Box', name: 'box1', typeArguments: JSON.stringify(['String']), args: JSON.stringify(['"Ada"']) })).body;
  assert.equal(box.display, 'Box<String>');
  const bounded = (await action({ op: 'create', className: 'Bounded', name: 'bounded1', typeArguments: JSON.stringify(['Int']), args: JSON.stringify(['7']) })).body;
  assert.equal(bounded.display, 'Bounded<Int>');
  const invalidBounded = (await action({ op: 'create', className: 'Bounded', name: 'invalidBounded', typeArguments: JSON.stringify(['String']), args: JSON.stringify(['"not a number"']) })).body;
  assert.equal(invalidBounded.kind, 'error');
  assert.equal((await action({ op: 'invoke', objectId: bounded.objectId, name: 'get', args: '[]' })).body.display, '7');
  assert.equal((await action({ op: 'invoke', objectId: box.objectId, name: 'replace', args: JSON.stringify(['42']) })).body.kind, 'error');
  assert.equal((await action({ op: 'invoke', objectId: box.objectId, name: 'get', args: '[]' })).body.display, 'Ada');
  assert.equal((await action({ op: 'remove', objectId: box.objectId })).body.display, 'Removed');
  assert.equal((await action({ op: 'invoke', objectId: box.objectId, name: 'get', args: '[]' })).body.kind, 'error');
  const overloadedInt = (await action({ op: 'create', className: 'Overloaded', name: 'overloadedInt', args: JSON.stringify(['7']) })).body;
  const overloadedString = (await action({ op: 'create', className: 'Overloaded', name: 'overloadedString', args: JSON.stringify(['"seven"']) })).body;
  assert.match((await action({ op: 'inspect', objectId: overloadedInt.objectId })).body.display, /kind="int"/);
  assert.match((await action({ op: 'inspect', objectId: overloadedString.objectId })).body.display, /kind="string"/);
  const child = (await action({ op: 'create', className: 'Child', name: 'child1', args: JSON.stringify(['"Ada"']) })).body;
  assert.match((await action({ op: 'inspect', objectId: child.objectId })).body.display, /baseValue="Ada"/);
  const packageSession = (await post('/api/session', {})).body;
  const packageFiles = [
    { id: 'package-person', fileName: 'PackagePerson.kt', kind: 'class', revision: 1, source: 'package demo\nclass PackagePerson(val name: String) { fun greet(): String = "Hi $name" }' },
    { id: 'package-helpers', fileName: 'PackageHelpers.kt', kind: 'functions', revision: 1, source: 'package demo\nfun twice(value: Int): Int = value * 2' },
    { id: 'package-image', fileName: 'Image.kt', kind: 'class', revision: 1, source: 'package demo\nimport java.awt.image.BufferedImage\nclass Image(val width: Int, val height: Int) { val awtImage = BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB); internal var transparency: Int = 255 }' },
    { id: 'package-actor', fileName: 'Actor.kt', kind: 'class', revision: 1, source: 'package demo\nopen class Actor { var x: Int = 0; var y: Int = 0; var rotation: Int = 0; var image: Image? = null; open fun act() {} }' },
    { id: 'package-world', fileName: 'World.kt', kind: 'class', revision: 1, source: 'package demo\nclass World(val width: Int, val height: Int, val cellSize: Int) { val actors = emptyList<Actor>(); val background = Image(width * cellSize, height * cellSize); open fun act() {}; fun allObjects(): List<Actor> = actors; fun show() { showWorld(this) }; fun showText(text: String, x: Int, y: Int) { setTextOf(this, x, y, text) } }' },
    { id: 'package-blueplay', fileName: 'BluePlayFunctions.kt', kind: 'functions', revision: 1, source: 'package demo\n// replaced by the headless BluePlay adapter' },
  ];
  const packageCompiled = await post(`/api/session/${packageSession.sessionId}/compile`, { files: packageFiles, revision: 1 });
  assert.equal(packageCompiled.body.diagnostics.length, 0, JSON.stringify(packageCompiled.body.diagnostics));
  const packageGeneration = packageCompiled.body.generationId;
  const packageAction = body => post(`/api/session/${packageSession.sessionId}/action`, { ...body, generationId: packageGeneration });
  const packagePerson = (await packageAction({ op: 'create', className: 'PackagePerson', name: 'packagePerson1', args: JSON.stringify(['"Ada"']) })).body;
  assert.equal((await packageAction({ op: 'invoke', objectId: packagePerson.objectId, name: 'greet', args: '[]' })).body.display, 'Hi Ada');
  assert.equal((await packageAction({ op: 'eval', code: 'counter1.current()', mode: 'expression' })).body.kind, 'error');
  assert.equal((await action({ op: 'invoke', objectId: packagePerson.objectId, name: 'greet', args: '[]' })).body.kind, 'error');
  assert.equal((await packageAction({ op: 'eval', code: 'twice(4)', mode: 'expression' })).body.display, '8');
  const packageWorld = (await packageAction({ op: 'create', className: 'World', name: 'packageWorld1', args: JSON.stringify(['4', '3', '1']) })).body;
  assert.equal((await packageAction({ op: 'invoke', objectId: packageWorld.objectId, name: 'show', args: '[]' })).body.kind, 'unit');
  assert.equal((await packageAction({ op: 'invoke', objectId: packageWorld.objectId, name: 'showText', args: JSON.stringify(['"hello"', '1', '2']) })).body.kind, 'unit');
  assert.equal((await json(`/api/session/${packageSession.sessionId}/stage`)).body.stage.width, 4);
  assert.deepEqual((await json(`/api/session/${packageSession.sessionId}/stage`)).body.stage.texts, [{ x: 1, y: 2, text: 'hello' }]);
  assert.equal((await post(`/api/session/${packageSession.sessionId}/close`, {})).response.status, 204);
  const stale = await post(`/api/session/${session.sessionId}/action`, { op: 'create', className: 'Counter', name: 'stale', args: '[]', generationId: 'old-generation' });
  assert.equal(stale.response.status, 409);
  const crashed = await action({ op: 'eval', code: 'System.exit(3)', mode: 'expression' });
  assert.equal(crashed.response.status, 500);
  await wait(100);
  const crashedStatus = (await json(`/api/session/${session.sessionId}/status`)).body;
  assert.equal(crashedStatus.available, false);
  assert.match(crashedStatus.error, /worker exited/);
  assert.equal((await json(`/api/session/${session.sessionId}/stage`)).response.status, 409);
  const recoveredCompile = await post(`/api/session/${session.sessionId}/compile`, { files, revision: 2 });
  assert.equal(recoveredCompile.response.status, 200, JSON.stringify(recoveredCompile));
  assert.equal(recoveredCompile.body.diagnostics.length, 0, JSON.stringify(recoveredCompile.body.diagnostics));
  const recoveredAction = body => post(`/api/session/${session.sessionId}/action`, { ...body, generationId: recoveredCompile.body.generationId });
  const recoveredCounter = (await recoveredAction({ op: 'create', className: 'Counter', name: 'recoveredCounter', args: '[]' })).body;
  assert.equal((await recoveredAction({ op: 'invoke', objectId: recoveredCounter.objectId, name: 'current', args: '[]' })).body.display, '0');
  const timedOut = await recoveredAction({ op: 'eval', code: 'while (true) { Thread.sleep(10) }', mode: 'block' });
  assert.equal(timedOut.response.status, 504, JSON.stringify(timedOut));
  assert.equal((await json(`/api/session/${session.sessionId}/status`)).body.available, false);
  console.log('BlueK runtime smoke test passed');
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await wait(100);
  if (output.includes('EADDRINUSE')) console.error(output);
}
