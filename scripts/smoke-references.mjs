import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

vm.runInThisContext(await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8'));
const api = globalThis['bluek-kotlite-browser'];
const ok = (raw) => { const result = JSON.parse(raw); assert.notEqual(result.kind, 'error', result.display); return result; };
const fail = (raw) => { const result = JSON.parse(raw); assert.equal(result.kind, 'error'); return result; };
const session = () => {
  const s = api.bluekCreateKotliteSession();
  ok(s.load('Timer.kt', `class Timer {
    var min = 0
    private set
    var max = 0
    private set
    val zeitspanne: Int get() = max - min
    fun setzeBereich(a: Int, b: Int) { min = a; max = b }
  }
  class Box(var item: Timer?)`));
  return s;
};
const evaluate = (s, code) => ok(s.evaluate('<Codepad>', code));
const snapshot = (s) => JSON.parse(s.referenceSnapshot());
const named = (s, name) => snapshot(s).references.find(r => r.name === name);

// User's exact failure: an unrelated declaration immediately after removal.
{
  const s = session();
  const original = ok(s.create('Timer', '', 'timer1'));
  evaluate(s, 'val t = timer1; val t2 = t; val t3 = t2');
  ok(s.bind(original.objectId, 't3'));
  ok(s.remove(original.objectId, 'timer1'));
  evaluate(s, 'val a = 5');
  evaluate(s, 't3.setzeBereich(5, 20)');
  assert.equal(evaluate(s, 't3.zeitspanne').display, '15');
  assert.equal(ok(s.get(original.objectId, 'zeitspanne')).display, '15');
  fail(s.evaluate('<Codepad>', 'timer1'));
  assert.equal(evaluate(s, 'a').display, '5');
  // Reusing a name must not retarget older aliases or replay initializers.
  const replacement = ok(s.create('Timer', '', 'timer1'));
  assert.notEqual(replacement.objectId, original.objectId);
  evaluate(s, 'timer1.setzeBereich(1, 3)');
  assert.equal(evaluate(s, 't3.zeitspanne').display, '15');
  assert.equal(evaluate(s, 'timer1.zeitspanne').display, '2');
  ok(s.remove(original.objectId, 't3'));
  assert.equal(named(s, 't3').onBench, false);
  assert.equal(evaluate(s, 't3.zeitspanne').display, '15');
  fail(s.create('Timer', '', 't3'));
  fail(s.bind(replacement.objectId, 't3'));
  evaluate(s, 'val stillHealthy = 9');
}

// Multiple removals, local declarations, mixed snippets and stable symbol IDs.
{
  const s = session();
  evaluate(s, 'var runs = 0');
  for (let i = 0; i < 4; i++) {
    const o = ok(s.create('Timer', '', 'o'));
    evaluate(s, 'run { val local = 4; runs += local }');
    evaluate(s, `val saved${i} = o; run { val local = 1; runs += local }`);
    ok(s.remove(o.objectId, 'o'));
    evaluate(s, `saved${i}.setzeBereich(${i}, 10)`);
  }
  assert.equal(evaluate(s, 'runs').display, '20');
  for (let i = 0; i < 4; i++) assert.equal(evaluate(s, `saved${i}.zeitspanne`).display, String(10-i));
}

// Historical handles are views, not owners, including previously evaluated objects.
{
  const s = session();
  const o = ok(s.create('Timer', '', 'o'));
  assert.equal(evaluate(s, 'o').objectId, o.objectId);
  ok(s.bind(o.objectId, 'alias'));
  ok(s.bind(o.objectId, 'alias')); // idempotent, retains interactive ownership
  ok(s.remove(o.objectId, 'o'));
  assert.equal(evaluate(s, 'alias.min').display, '0');
  ok(s.remove(o.objectId, 'alias'));
  assert.equal(snapshot(s).liveObjectIds.includes(o.objectId), false);
  fail(s.inspect(o.objectId)); fail(s.bind(o.objectId, 'resurrected'));
  fail(s.invoke(o.objectId, 'setzeBereich', '1, 2'));
  fail(s.get(o.objectId, 'min')); fail(s.set(o.objectId, 'min', '2'));
  evaluate(s, 'val a = 5');
  ok(s.create('Timer', '', 'o'));
}

// Nameless results can be adopted; after removal they cannot be resurrected.
{
  const s = session();
  const o = evaluate(s, 'Timer()');
  ok(s.bind(o.objectId, 'o'));
  ok(s.remove(o.objectId, 'o'));
  fail(s.bind(o.objectId, 'o'));
  evaluate(s, 'val independent = 1');
}

// A bench view follows a mutable Codepad binding, never a cached object ID.
{
  const s = session();
  evaluate(s, 'var t = Timer()');
  const first = evaluate(s, 't');
  ok(s.bind(first.objectId, 't'));
  evaluate(s, 'val saved = t; t = Timer()');
  const second = evaluate(s, 't');
  assert.notEqual(second.objectId, first.objectId);
  assert.equal(named(s, 't').objectId, second.objectId);
  fail(s.remove(first.objectId, 't')); // stale command cannot remove a different value
  ok(s.remove(second.objectId, 't'));
  assert.equal(named(s, 't').onBench, false);
  assert.equal(evaluate(s, 'saved').objectId, first.objectId);
  evaluate(s, 't = Timer()');
  fail(s.inspect(second.objectId));
}

// Indirect references (fields, cycles, containers, captured values) keep identity.
{
  const s = session();
  evaluate(s, 'val box = Box(Timer())');
  const box = evaluate(s, 'box');
  const child = ok(s.inspectField(box.objectId, 'item'));
  assert.equal(child.kind, 'inspect');
  assert.equal(child.fields.find(field => field.name === 'min').value, '0');
  assert.equal(snapshot(s).liveObjectIds.includes(child.objectId), true);
  evaluate(s, 'box.item = null');
  fail(s.inspect(child.objectId));
  fail(s.inspectField(box.objectId, 'item'));
}
for (const [setup, access, release] of [
  ['val box = Box(o)', 'box.item', 'box.item = null'],
  ['val items = mutableListOf(o)', 'items[0]', 'items.clear()'],
  ['val items = mutableMapOf("x" to o)', 'items["x"]', 'items.clear()'],
  ['val pair = o to 1', 'pair.first', null],
  ['val later = { o }', 'later()', null],
  ['val later = { o }', 'listOf(1).map { later() }[0]', null],
  ['val later: (Int) -> Timer = { o }', 'listOf(1).map(later)[0]', null],
  ['val iterator = listOf(o).iterator()', 'iterator.next()', null],
]) {
  const s = session(); const o = ok(s.create('Timer', '', 'o'));
  evaluate(s, setup); ok(s.remove(o.objectId, 'o'));
  assert.equal(evaluate(s, access).objectId, o.objectId, setup);
  ok(s.inspect(o.objectId));
  if (release) { evaluate(s, release); fail(s.inspect(o.objectId)); }
}

// A fresh detached result is transferable without reviving old history handles.
{
  const s = session();
  const o = ok(s.create('Timer', '', 'o'));
  evaluate(s, 'val items = mutableListOf(o)');
  ok(s.remove(o.objectId, 'o'));
  const detached = evaluate(s, 'items.removeAt(0)');
  assert.notEqual(detached.objectId, o.objectId);
  fail(s.inspect(o.objectId));
  ok(s.bind(detached.objectId, 'detached'));
  ok(s.remove(detached.objectId, 'detached'));
  fail(s.inspect(detached.objectId));
}

// Cycles do not keep an otherwise unreachable object alive.
{
  const s = session();
  evaluate(s, 'class Node { var next: Node? = null }');
  const a = ok(s.create('Node', '', 'a')); const b = ok(s.create('Node', '', 'b'));
  evaluate(s, 'a.next = b; b.next = a');
  ok(s.remove(a.objectId, 'a'));
  assert.equal(evaluate(s, 'b.next').objectId, a.objectId);
  ok(s.remove(b.objectId, 'b'));
  fail(s.inspect(a.objectId)); fail(s.inspect(b.objectId));
  evaluate(s, 'val fresh = 5');
}

// Passive reachability does not run getters; initializer side effects run once.
{
  const s = session();
  evaluate(s, 'var count = 0; val t = run { count += 1; Timer() }');
  const o = ok(s.create('Timer', '', 'o'));
  ok(s.remove(o.objectId, 'o'));
  evaluate(s, 'val another = 7');
  assert.equal(evaluate(s, 'count').display, '1');
  ok(s.reset());
  assert.deepEqual(snapshot(s), { references: [], liveObjectIds: [] });
  fail(s.inspect(o.objectId));
  ok(s.load('Timer.kt', 'class Timer {}'));
  ok(s.create('Timer', '', 'o'));
  fail(s.inspect(o.objectId)); // even direct session reset never recycles handles
}

// Reject conflicts before constructor effects; scalar variables occupy the namespace too.
{
  const s = session();
  evaluate(s, 'val taken = 5; class Loud { init { println("created") } }');
  fail(s.create('Loud', '', 'taken'));
  assert.equal(s.takeOutput(), '');
  fail(s.create('Loud', '', '__bluek_reserved'));
  assert.equal(s.takeOutput(), '');
  const fresh = evaluate(s, 'Timer()');
  fail(s.bind(fresh.objectId, 'taken'));
  assert.equal(evaluate(s, 'taken').display, '5');
  ok(s.bind(fresh.objectId, 'available'));
  assert.equal(named(s, 'available').origin, 'interactive');
}
console.log('Reference lifetime regressions passed.');
