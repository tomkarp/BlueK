import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { rolldown } from 'rolldown';

// Bundle the actual production gateway/host, not a duplicate implementation.
async function loadModule(path) {
  const bundle = await rolldown({ input: path });
  const { output } = await bundle.generate({ format: 'esm' });
  await bundle.close();
  return import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
}
const { LocalRuntimeClient } = await loadModule('frontend/src/localRuntimeClient.ts');
const { RuntimeHost } = await loadModule('frontend/src/runtimeHost.ts');
vm.runInThisContext(await readFile('frontend/public/kotlite/bluek-kotlite-browser.js', 'utf8'));
const createSession = globalThis['bluek-kotlite-browser'].bluekCreateKotliteSession;
const workers = [];
class TestWorker {
  host = new RuntimeHost(createSession);
  terminated = false;
  paused = false;
  queued = [];
  postMessage(command) {
    const deliver = () => {
      // Deliberately also deliver after termination: the client must reject stale replies.
      this.host.dispatch(command.id, command, data => this.onmessage?.({ data }));
    };
    if (this.paused) this.queued.push(deliver);
    else setTimeout(deliver, 0);
  }
  terminate() { this.terminated = true; }
}
const client = new LocalRuntimeClient(() => { const worker = new TestWorker(); workers.push(worker); return worker; });
const files = [
  { id: 'counter', fileName: 'Counter.kt', kind: 'class', revision: 1, source: `
open class Counter(var n: Int) {
    fun add(amount: Int = 1) { n += amount }
    fun self(): Counter = this
    val computed: Int
        get() { n++; return n }
    fun ask() { n++; print("prompt: "); val text = readln(); println(text); n++ }
}
` },
  { id: 'child', fileName: 'Child.kt', kind: 'class', revision: 1, source: 'class Child(n: Int): Counter(n)' },
  { id: 'functions', fileName: 'Actions.kt', kind: 'functions', revision: 1, source: `
val shared = Counter(10)
fun main() { shared.add(5) }
fun readTwo() { print("A"); println(readln()); print("B"); println(readln()) }
fun loopOutput() { for (i in 1..3) println(i) }
` },
];
const outputs = [];
client.onResponse(value => { if (value.output) outputs.push(value.output); });
const waitForPhase = phase => new Promise((resolve, reject) => {
  const started = Date.now();
  const unsubscribe = client.subscribe(() => {
    if (client.getSnapshot().phase === phase) { unsubscribe(); resolve(); }
    else if (Date.now() - started > 2000) { unsubscribe(); reject(new Error(`Timed out waiting for ${phase}`)); }
  });
  if (client.getSnapshot().phase === phase) { unsubscribe(); resolve(); }
});
const ok = async command => {
  const value = await client.execute(command);
  assert.notEqual(value.kind, 'error', value.display);
  return value;
};
const field = (objectId, name = 'n') => client.getSnapshot().inspections[objectId].fields.find(field => field.name === name).value;
// End-to-end gateway/host snapshots: no independently maintained UI bindings.
{
  const refs = new LocalRuntimeClient(() => new TestWorker());
  await refs.compile(files, 1);
  const run = async command => {
    const result = await refs.execute(command);
    assert.notEqual(result.kind, 'error', result.display);
    return result;
  };
  const first = await run({ op: 'create', className: 'Counter', name: 'counter', args: ['7'] });
  await run({ op: 'eval', code: 'var alias = counter' });
  await run({ op: 'bind', objectId: first.objectId, name: 'alias' });
  await run({ op: 'remove', objectId: first.objectId, name: 'counter' });
  await run({ op: 'eval', code: 'val unrelated = 5' });
  assert.equal((await run({ op: 'eval', code: 'alias.n' })).display, '7');
  await run({ op: 'eval', code: 'alias = Counter(20)' });
  const view = refs.getSnapshot().references.find(r => r.name === 'alias');
  assert.equal(view.onBench, true);
  assert.notEqual(view.objectId, first.objectId);
  assert.equal(refs.getSnapshot().liveObjectIds.includes(first.objectId), false);
  assert.equal(refs.getSnapshot().inspections[first.objectId], undefined);
  await run({ op: 'remove', objectId: view.objectId, name: 'alias' });
  assert.equal(refs.getSnapshot().references.find(r => r.name === 'alias').onBench, false);
  assert.equal((await run({ op: 'eval', code: 'alias.n' })).display, '20');
  await refs.reset();
  assert.deepEqual(refs.getSnapshot().references.map(r => r.name), ['shared']);
  refs.invalidate();
}
assert.equal((await client.compile(files, 1)).diagnostics.length, 0);
assert.equal(client.getSnapshot().phase, 'ready');
assert.ok(client.getSnapshot().classes.find(c => c.id === 'Actions.kt').methods.some(m => m.name === 'main'));
const first = await client.execute({ op: 'create', className: 'Child', name: 'child', args: ['1'] });
assert.notEqual(first.kind, 'error', first.display);
assert.equal(field(first.objectId), '1');
await ok({ op: 'invoke', objectId: first.objectId, name: 'add', args: ['2'] });
assert.equal(field(first.objectId), '3');
assert.equal((await ok({ op: 'eval', code: 'child.n' })).display, '3');
await ok({ op: 'set', objectId: first.objectId, property: 'n', value: '8' });
assert.equal((await ok({ op: 'eval', code: 'child.n' })).display, '8');
await ok({ op: 'eval', code: 'child.n = 12' });
assert.equal(field(first.objectId), '12');
const same = await ok({ op: 'invoke', objectId: first.objectId, name: 'self', args: [] });
assert.equal(same.objectId, first.objectId, 'identity must be canonical');
await ok({ op: 'bind', objectId: same.objectId, name: 'alias' });
await ok({ op: 'eval', code: 'alias.add()' });
assert.equal(field(first.objectId), '13');
await ok({ op: 'inspect', objectId: first.objectId });
assert.equal(field(first.objectId), '13', 'inspection must not call computed getters');
assert.equal(field(first.objectId, 'computed'), '<computed>');
const shared = await ok({ op: 'eval', code: 'shared' });
assert.equal(field(shared.objectId), '10', 'top-level initializer must run once');
await ok({ op: 'main', fileName: 'Actions.kt' });
assert.equal(field(shared.objectId), '15');
await ok({ op: 'main', fileName: 'Actions.kt' });
assert.equal(field(shared.objectId), '20');
const loopExecution = client.execute({ op: 'eval', code: 'loopOutput()' });
await loopExecution;
assert.equal(outputs.splice(0).join(''), '1\n2\n3\n', 'batched output must preserve every line in order and flush at completion');
const trailingOutput = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Buffered output was not flushed during sleep.')); }, 2000);
  const unsubscribe = client.onResponse(() => {
    if (outputs.join('') === 'firstbuffered') {
      clearTimeout(timeout); unsubscribe(); resolve(client.getSnapshot().phase);
    }
  });
});
const sleepingOutput = client.execute({ op: 'eval', code: 'print("first"); print("buffered"); Thread.sleep(1000)' });
assert.equal(await trailingOutput, 'running', 'trailing output must appear before the sleeping command completes');
await sleepingOutput;
assert.equal(outputs.splice(0).join(''), 'firstbuffered');
const string = await ok({ op: 'eval', code: '"true"' });
assert.equal(string.type.displayName, 'String');
assert.equal((await ok({ op: 'eval', code: 'true' })).type.displayName, 'Boolean');
const invalid = await client.execute({ op: 'set', objectId: first.objectId, property: 'n', value: '"bad"' });
assert.equal(invalid.phase, 'analysis');
assert.equal(client.getSnapshot().phase, 'ready');
assert.equal(field(first.objectId), '13');
const readTwo = client.execute({ op: 'eval', code: 'readTwo()' });
await waitForPhase('waitingForInput');
await client.sendInput('one');
await waitForPhase('waitingForInput');
await client.sendInput('two');
await readTwo;
assert.equal(outputs.splice(0).join(''), 'Aone\nBtwo\n');
assert.equal((await ok({ op: 'eval', code: 'alias' })).objectId, first.objectId);
assert.equal(field(first.objectId), '13', 'all retained handles observe the same object');

const pendingAsk = client.execute({ op: 'invoke', objectId: first.objectId, name: 'ask', args: [] });
await waitForPhase('waitingForInput');
assert.equal(field(first.objectId), '14');
assert.equal(outputs.splice(0).join(''), 'prompt: ');
await client.sendInput('later');
const askResult = await pendingAsk;
assert.equal(askResult.kind, 'unit');
assert.equal(field(first.objectId), '15');
assert.equal((await client.reset()).diagnostics.length, 0);
assert.equal(client.getSnapshot().phase, 'ready');
assert.deepEqual(client.getSnapshot().references.map(r => r.name), ['shared']);
assert.equal(client.getSnapshot().references.some(r => r.onBench), false);
assert.equal((await ok({ op: 'eval', code: 'shared.n' })).display, '10');
await ok({ op: 'create', className: 'Counter', name: 'child', args: ['0'] });

workers.at(-1).paused = true;
const oldWorker = workers.at(-1);
const pending = client.execute({ op: 'eval', code: 'child.n = 99' });
assert.equal(client.getSnapshot().phase, 'running');
await assert.rejects(client.execute({ op: 'eval', code: 'child.n' }), /Another runtime command/);
const rejected = assert.rejects(pending, /generation replaced/);
client.invalidate();
await rejected;
await client.compile(files, 2);
const current = client.getSnapshot();
oldWorker.queued.forEach(deliver => deliver());
assert.equal(client.getSnapshot(), current, 'stale responses must not publish state');

const brokenWorker = workers.at(-1);
brokenWorker.paused = true;
const broken = client.execute({ op: 'eval', code: 'shared.n' });
const failed = assert.rejects(broken, /worker failure/);
brokenWorker.onerror({ message: 'test worker failure' });
await failed;
assert.equal(client.getSnapshot().phase, 'faulted');
assert.equal(brokenWorker.terminated, true);
await client.reset();
assert.equal(client.getSnapshot().phase, 'ready');
client.invalidate();
const initializerClient = new LocalRuntimeClient(() => new TestWorker());
const initializerFiles = [{ id: 'init', fileName: 'Init.kt', kind: 'functions', revision: 1, source: 'fun initialize(): String { print("init: "); return readln() }\nval initialized = initialize()' }];
const initializerCompile = initializerClient.compile(initializerFiles, 1);
await new Promise((resolve, reject) => {
  const started = Date.now();
  const unsubscribe = initializerClient.subscribe(() => {
    if (initializerClient.getSnapshot().phase === 'waitingForInput') { unsubscribe(); resolve(); }
    else if (Date.now() - started > 2000) { unsubscribe(); reject(new Error('Timed out waiting for top-level initializer input')); }
  });
});
assert.equal(initializerClient.getSnapshot().phase, 'waitingForInput');
await initializerClient.sendInput('Ada');
assert.equal((await initializerCompile).diagnostics.length, 0);
assert.equal((await initializerClient.execute({ op: 'eval', code: 'initialized' })).display, 'Ada');
initializerClient.invalidate();

// RT-02: project files are declaration-only; Codepad remains executable.
const projectClient = new LocalRuntimeClient(() => new TestWorker());
const projectOutputs = [];
projectClient.onResponse(value => { if (value.output) projectOutputs.push(value.output); });
const file = (fileName, source) => ({ id: fileName, fileName, source, kind: 'functions', revision: 1 });
const sideEffect = file('Init.kt', 'fun initialize(): Int { println("MUST NOT RUN"); return 1 }\nval initialized = initialize()');
for (const statement of ['println("Hallo")', 'initialized = 2', 'for (i in 1..3) println(i)', 'if (true) println("Hallo")', '42']) {
  const result = await projectClient.compile([sideEffect, file('Statements.kt', `// a comment\n\n  ${statement}`)], 1);
  assert.equal(result.diagnostics.length, 1, statement);
  const diagnostic = result.diagnostics[0];
  assert.equal(diagnostic.fileName, 'Statements.kt');
  assert.equal(diagnostic.line, 3);
  assert.equal(diagnostic.column, 3);
  assert.match(diagnostic.message, /Only declarations/);
  assert.equal(result.generationId, '');
  assert.equal(projectClient.getSnapshot().phase, 'uncompiled');
  assert.deepEqual(projectOutputs, [], 'no initializer may run before all files are validated');
  await assert.rejects(projectClient.execute({ op: 'eval', code: 'println("bypass")' }), /compile the project/);
}
const syntaxError = await projectClient.compile([sideEffect, file('Broken.kt', '\nfun broken( {}')], 2);
assert.equal(syntaxError.diagnostics[0].fileName, 'Broken.kt');
assert.equal(syntaxError.diagnostics[0].line, 2);
assert.deepEqual(projectOutputs, [], 'syntax errors must also prevent initialization');
const semanticError = await projectClient.compile([sideEffect, file('Types.kt', 'val number: Int = "wrong"')], 3);
assert.equal(semanticError.diagnostics[0].fileName, 'Types.kt');
assert.deepEqual(projectOutputs, [], 'semantic analysis must finish before initialization');
assert.equal(projectClient.getSnapshot().phase, 'uncompiled');
const mixedClass = await projectClient.compile([
  sideEffect,
  file('Mixed.kt', 'class Mixed {}\nfun main() {}'),
], 4);
assert.equal(mixedClass.diagnostics.length, 1);
assert.equal(mixedClass.diagnostics[0].fileName, 'Mixed.kt');
assert.equal(mixedClass.diagnostics[0].line, 2);
assert.match(mixedClass.diagnostics[0].message, /one class|top-level functions/i);
assert.equal(mixedClass.generationId, '');
assert.equal(projectClient.getSnapshot().phase, 'uncompiled');
const multipleClasses = await projectClient.compile([
  sideEffect,
  file('Multiple.kt', 'class First {}\nclass Second {}'),
], 5);
assert.equal(multipleClasses.diagnostics.length, 1);
assert.equal(multipleClasses.diagnostics[0].fileName, 'Multiple.kt');
assert.equal(multipleClasses.diagnostics[0].line, 2);
assert.match(multipleClasses.diagnostics[0].message, /one class/i);
assert.equal(multipleClasses.generationId, '');
assert.equal(projectClient.getSnapshot().phase, 'uncompiled');
const declarations = await projectClient.compile([
  file('Named.kt', 'interface Named { fun name(): String }'),
  file('Example.kt', 'class Example: Named { override fun name(): String = "Example" }'),
  file('Actions.kt', '/* println("not a statement") */\nvar count = 0\nval greeting = "println(\\"text\\")"\nfun main() { println("Hallo"); count += 1 }'),
], 6);
assert.deepEqual(declarations.diagnostics, []);
assert.deepEqual(projectOutputs, [], 'declaring main does not execute it');
for (const code of ['println("Codepad")', 'count = 2', 'for (i in 1..2) println(i)']) {
  const value = await projectClient.execute({ op: 'eval', code });
  assert.notEqual(value.kind, 'error', value.display);
}
assert.equal(projectOutputs.splice(0).join(''), 'Codepad\n1\n2\n');
assert.equal((await projectClient.execute({ op: 'eval', code: 'count' })).display, '2');
assert.notEqual((await projectClient.execute({ op: 'main', fileName: 'Actions.kt' })).kind, 'error');
assert.equal(projectOutputs.splice(0).join(''), 'Hallo\n');
for (const template of ['kotlin-example', 'blueplay-empty', 'blueplay']) {
  const payload = JSON.parse(await readFile(`frontend/public/examples/${template}.bluek.json`, 'utf8'));
  const builtinFiles = new Set(['World.kt', 'Actor.kt', 'Image.kt', 'BluePlayFunctions.kt', 'BluePlayHelpers.kt']);
  const projectFiles = payload.library?.id === 'blueplay'
    ? payload.files.filter(entry => !builtinFiles.has(entry.fileName))
    : payload.files;
  const result = await projectClient.compile(projectFiles.map(entry => ({ ...entry, id: entry.fileName })), 5, payload.library);
  assert.deepEqual(result.diagnostics, [], `${template} must still compile through the project loader`);
}
const nativePayload = JSON.parse(await readFile('frontend/public/examples/blueplay.bluek.json', 'utf8'));
const builtinFiles = new Set(['World.kt', 'Actor.kt', 'Image.kt', 'BluePlayFunctions.kt', 'BluePlayHelpers.kt']);
const nativeProjectFiles = nativePayload.files
  .filter(entry => !builtinFiles.has(entry.fileName))
  .map(entry => ({ ...entry, id: entry.fileName }));
const nativeClient = new LocalRuntimeClient(() => new TestWorker());
const nativeStages = [];
nativeClient.stageStream(value => nativeStages.push(value));
const nativeCompile = await nativeClient.compile(nativeProjectFiles, 1, nativePayload.library, nativePayload.resources);
assert.deepEqual(nativeCompile.diagnostics, []);
await nativeClient.execute({ op: 'main', fileName: 'Main.kt' });
await nativeClient.simulation('step');
assert.equal(nativeStages.at(-1)?.objects[0]?.x, 101, 'native scheduler must dispatch one BluePlay step');
const inputSnapshot = nativeClient.getSnapshot();
const inputFrameCount = nativeStages.length;
let inputNotifications = 0;
const unsubscribeInput = nativeClient.subscribe(() => inputNotifications++);
await Promise.all([nativeClient.sendKey('left', true), nativeClient.sendKey('space', true)]);
await Promise.all([nativeClient.sendKey('left', false), nativeClient.sendKey('space', false)]);
assert.equal(nativeClient.getSnapshot(), inputSnapshot, 'device input must not toggle the IDE execution phase');
assert.equal(inputNotifications, 0, 'input acknowledgements must not republish IDE snapshots');
assert.equal(nativeStages.length, inputFrameCount, 'input acknowledgements must not redraw old frames');
unsubscribeInput();
await nativeClient.simulation('setSpeed', 80);
assert.equal(nativeClient.getSnapshot().simulation, 'paused');
await nativeClient.simulation('start');
assert.equal(nativeClient.getSnapshot().simulation, 'running');
await new Promise(resolve => setTimeout(resolve, 20));
await nativeClient.simulation('stop');
assert.ok(['paused', 'stopping'].includes(nativeClient.getSnapshot().simulation));
await nativeClient.reset();
assert.equal(nativeClient.getSnapshot().simulation, 'paused');
nativeClient.invalidate();
projectClient.invalidate();
console.log('Runtime state integration passed: shared identity, main, inspectors, input, reset, concurrency, stale replies and transport failure.');
console.log('Project validation passed: declarations only, source positions, no effects on rejection, recovery and executable Codepad.');
