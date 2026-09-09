import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const base = 'http://127.0.0.1:5173';
const server = spawn('node', ['server/dist/server/src/index.js'], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', chunk => { output += chunk.toString(); });
server.stderr.on('data', chunk => { output += chunk.toString(); });
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
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
  await wait(500);
  const session = (await post('/api/session', {})).body;
  const files = [
    { id: 'counter', fileName: 'Counter.kt', kind: 'class', revision: 1, source: 'class Counter(var value: Int = 0) { fun increment() { value++ }; fun add(amount: Int) { value += amount }; fun current(): Int = value }' },
    { id: 'person', fileName: 'Person.kt', kind: 'class', revision: 1, source: 'class Person(var name: String) { fun greet(): String = "Hello, $name!"; fun rename(newName: String) { name = newName }; fun greetInConsole() { println(greet()) } }' },
    { id: 'helpers', fileName: 'Helpers.kt', kind: 'functions', revision: 1, source: 'fun square(x: Int): Int = x * x; fun askName(): String { println("What is your name?"); val name = readln(); println("Hello, $name!"); return name }' },
    { id: 'box', fileName: 'Box.kt', kind: 'class', revision: 1, source: 'class Box<T>(var value: T) { fun replace(next: T) { value = next }; fun get(): T = value }' },
    { id: 'overloaded', fileName: 'Overloaded.kt', kind: 'class', revision: 1, source: 'class Overloaded { val kind: String; constructor(value: Int) { kind = "int" }; constructor(value: String) { kind = "string" } }' },
  ];
  const compiled = await post(`/api/session/${session.sessionId}/compile`, { files, revision: 1 });
  assert.equal(compiled.body.diagnostics.length, 0);
  assert.equal(compiled.body.classes.find(value => value.name === 'Overloaded').constructors.length, 2);
  assert.equal(compiled.body.classes.find(value => value.name === 'Person').methods.find(value => value.name === 'greet').parameters.length, 0);
  const generationId = compiled.body.generationId;
  const action = body => post(`/api/session/${session.sessionId}/action`, { ...body, generationId });
  const counter = (await action({ op: 'create', className: 'Counter', name: 'counter1', args: JSON.stringify(['3']) })).body;
  assert.equal((await action({ op: 'invoke', objectId: counter.objectId, name: 'increment', args: '[]' })).body.kind, 'unit');
  await action({ op: 'invoke', objectId: counter.objectId, name: 'add', args: JSON.stringify(['5']) });
  assert.equal((await action({ op: 'invoke', objectId: counter.objectId, name: 'current', args: '[]' })).body.display, '9');
  assert.match((await action({ op: 'inspect', objectId: counter.objectId })).body.display, /value=9/);
  const person = (await action({ op: 'create', className: 'Person', name: 'person1', args: JSON.stringify(['"Ada"']) })).body;
  assert.equal((await action({ op: 'invoke', objectId: person.objectId, name: 'greet', args: '[]' })).body.display, 'Hello, Ada!');
  assert.equal((await action({ op: 'invoke', objectId: person.objectId, name: 'greetInConsole', args: '[]' })).body.output, 'Hello, Ada!\n');
  const waiting = action({ op: 'eval', code: 'askName()', mode: 'expression' });
  await wait(700);
  assert.equal((await post(`/api/session/${session.sessionId}/input`, { text: 'Kotlin' })).response.status, 202);
  assert.equal((await waiting).body.display, 'Kotlin');
  assert.equal((await action({ op: 'eval', code: 'square(7)', mode: 'expression' })).body.display, '49');
  assert.equal((await action({ op: 'eval', code: 'error("Demo")', mode: 'expression' })).body.kind, 'error');
  assert.equal((await action({ op: 'eval', code: 'square(7)', mode: 'expression' })).body.display, '49');
  const box = (await action({ op: 'create', className: 'Box', name: 'box1', typeArguments: JSON.stringify(['String']), args: JSON.stringify(['"Ada"']) })).body;
  assert.equal((await action({ op: 'invoke', objectId: box.objectId, name: 'replace', args: JSON.stringify(['42']) })).body.kind, 'error');
  assert.equal((await action({ op: 'invoke', objectId: box.objectId, name: 'get', args: '[]' })).body.display, 'Ada');
  const overloadedInt = (await action({ op: 'create', className: 'Overloaded', name: 'overloadedInt', args: JSON.stringify(['7']) })).body;
  const overloadedString = (await action({ op: 'create', className: 'Overloaded', name: 'overloadedString', args: JSON.stringify(['"seven"']) })).body;
  assert.match((await action({ op: 'inspect', objectId: overloadedInt.objectId })).body.display, /kind=int/);
  assert.match((await action({ op: 'inspect', objectId: overloadedString.objectId })).body.display, /kind=string/);
  const stale = await post(`/api/session/${session.sessionId}/action`, { op: 'create', className: 'Counter', name: 'stale', args: '[]', generationId: 'old-generation' });
  assert.equal(stale.response.status, 409);
  console.log('BlueK runtime smoke test passed');
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await wait(100);
  if (output.includes('EADDRINUSE')) console.error(output);
}
