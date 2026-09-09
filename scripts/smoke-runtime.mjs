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
    { id: 'person', fileName: 'Person.kt', kind: 'class', revision: 1, source: 'class Person(var name: String) { fun greet(): String = "Hello, $name!"; fun rename(newName: String) { name = newName }; fun greetInConsole() { println(greet()) }; fun friend(): Person = Person("$name Jr") }' },
    { id: 'helpers', fileName: 'Helpers.kt', kind: 'functions', revision: 1, source: 'fun square(x: Int): Int = x * x; fun askName(): String { println("What is your name?"); val name = readln(); println("Hello, $name!"); return name }' },
    { id: 'box', fileName: 'Box.kt', kind: 'class', revision: 1, source: 'class Box<T>(var value: T) { fun replace(next: T) { value = next }; fun get(): T = value }' },
    { id: 'overloaded', fileName: 'Overloaded.kt', kind: 'class', revision: 1, source: 'class Overloaded { val kind: String; constructor(value: Int) { kind = "int" }; constructor(value: String) { kind = "string" } }' },
    { id: 'base', fileName: 'Base.kt', kind: 'class', revision: 1, source: 'open class Base(var baseValue: String)' },
    { id: 'child', fileName: 'Child.kt', kind: 'class', revision: 1, source: 'class Child(baseValue: String): Base(baseValue) { var ownValue: Int = 7 }' },
    { id: 'tools', fileName: 'Tools.kt', kind: 'class', revision: 1, source: 'object Tools { fun twice(value: Int): Int = value * 2; fun ping() { println("pong") } }' },
    { id: 'abstract', fileName: 'AbstractThing.kt', kind: 'class', revision: 1, source: 'abstract class AbstractThing { fun ping() {} }' },
  ];
  const compiled = await post(`/api/session/${session.sessionId}/compile`, { files, revision: 1 });
  assert.equal(compiled.body.diagnostics.length, 0);
  assert.equal(compiled.body.classes.find(value => value.name === 'Overloaded').constructors.length, 2);
  assert.equal(compiled.body.classes.find(value => value.name === 'Person').methods.find(value => value.name === 'greet').parameters.length, 0);
  assert.equal(compiled.body.classes.find(value => value.name === 'Helpers').kind, 'functions');
  assert.equal(compiled.body.classes.find(value => value.name === 'Helpers').methods.find(value => value.name === 'square').parameters.length, 1);
  assert.equal(compiled.body.classes.find(value => value.name === 'Tools').kind, 'object');
  assert.equal(compiled.body.classes.find(value => value.name === 'Tools').constructors.length, 0);
  assert.equal(compiled.body.classes.find(value => value.name === 'AbstractThing').kind, 'abstract');
  assert.equal(compiled.body.classes.find(value => value.name === 'AbstractThing').constructors.length, 0);
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
  assert.equal((await action({ op: 'eval', code: 'var optionalName: String? = null', mode: 'block' })).body.kind, 'unit');
  assert.equal((await action({ op: 'eval', code: 'optionalName == null', mode: 'expression' })).body.display, 'true');
  const waiting = action({ op: 'eval', code: 'askName()', mode: 'expression' });
  const liveEvents = [];
  for (let attempt = 0; attempt < 30 && !liveEvents.some(event => event.output?.includes('What is your name?')); attempt++) {
    await wait(500);
    liveEvents.push(...(await json(`/api/session/${session.sessionId}/events`)).body);
  }
  assert.match(liveEvents.map(event => event.output || '').join(''), /What is your name\?/);
  assert.equal((await post(`/api/session/${session.sessionId}/input`, { text: 'Kotlin' })).response.status, 202);
  assert.equal((await waiting).body.display, 'Kotlin');
  assert.equal((await action({ op: 'eval', code: 'square(7)', mode: 'expression' })).body.display, '49');
  assert.equal((await action({ op: 'eval', code: 'Tools.twice(7)', mode: 'expression' })).body.display, '14');
  assert.equal((await action({ op: 'eval', code: 'error("Demo")', mode: 'expression' })).body.kind, 'error');
  assert.equal((await action({ op: 'eval', code: 'square(7)', mode: 'expression' })).body.display, '49');
  const box = (await action({ op: 'create', className: 'Box', name: 'box1', typeArguments: JSON.stringify(['String']), args: JSON.stringify(['"Ada"']) })).body;
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
  const stale = await post(`/api/session/${session.sessionId}/action`, { op: 'create', className: 'Counter', name: 'stale', args: '[]', generationId: 'old-generation' });
  assert.equal(stale.response.status, 409);
  console.log('BlueK runtime smoke test passed');
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await wait(100);
  if (output.includes('EADDRINUSE')) console.error(output);
}
