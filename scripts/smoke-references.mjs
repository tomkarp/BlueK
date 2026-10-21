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

// GUI-142: the AST's direct variable read supplies the Get suggestion; identity
// alone must not turn a returned value into a named result.
{
  const s = session();
  evaluate(s, 'val field = Timer()');
  const direct = evaluate(s, '/* direct read */ field');
  assert.equal(direct.name, 'field');
  const alias = evaluate(s, 'val another = field; another');
  assert.equal(alias.name, 'another');
  assert.equal(alias.objectId, direct.objectId);
  ok(s.bind(alias.objectId, alias.name));
  assert.equal(named(s, 'another').onBench, true);
  assert.equal(named(s, 'another').origin, 'persistent');
  assert.equal(snapshot(s).references.filter(r => r.onBench).length, 1);
  evaluate(s, 'fun existing(): Timer = field');
  const returned = evaluate(s, 'existing()');
  assert.equal(returned.objectId, direct.objectId);
  assert.equal(returned.name, undefined, 'Method results do not borrow an alias');
  assert.equal(evaluate(s, 'run { val local = field; local }').name, undefined);
  assert.equal(evaluate(s, 'val box = Box(field); box.item').name, undefined);
  assert.equal(evaluate(s, 'Timer()').name, undefined);
  assert.equal(evaluate(s, 'val count = 17; count').name, 'count');
}

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
// The BluePlay engine keeps a world's actors natively, not in a field. An actor
// reachable only through its world keeps its handle until it leaves the world.
{
  const s = api.bluekCreateKotliteSession();
  s.configureBluePlay(true, 'references');
  const loaded = JSON.parse(await new Promise(resolve => {
    const started = s.startLoadProject(['Duck.kt'], ['class Duck : Actor()'], 'blueplay', 1, () => {}, resolve);
    if (JSON.parse(started).kind === 'error') resolve(started);
  }));
  assert.notEqual(loaded.kind, 'error', loaded.display);
  const image = evaluate(s, 'Image(10, 20)');
  assert.equal(image.display, '<object> : Image');
  assert.equal(image.defaultObjectDisplay, true);
  evaluate(s, 'val pond = World(20, 20, 1)');
  const duck = ok(s.create('Duck', '', 'duck'));
  evaluate(s, 'pond.addObject(duck, 3, 4)');
  ok(s.remove(duck.objectId, 'duck'));
  assert.ok(snapshot(s).liveObjectIds.includes(duck.objectId), 'an actor in a named world stays addressable');
  assert.equal(ok(s.get(duck.objectId, 'x')).display, '3');
  evaluate(s, 'pond.removeObject(pond.allObjects()[0])');
  assert.ok(!snapshot(s).liveObjectIds.includes(duck.objectId), 'a removed actor is no longer retained by its world');
}
// GUI-148: the inspector follows every non-null value, with active toString text
// and passive snapshots/navigation. Computed values are captured, not read twice.
{
  const s = api.bluekCreateKotliteSession();
  ok(s.load('Inspection.kt', `
    class Label {
      var textReads = 0
      override fun toString(): String { textReads += 1; return "shown label" }
    }
    class Broken { val safe = 7; override fun toString(): String = error("bad text") }
    class Inspection {
      var number = 42
      val text = "hello"
      val flag = true
      val numbers = listOf(1, 2)
      val label = Label()
      val broken = Broken()
      val absent: String? = null
      var reads = 0
      val calculated: Int get() { reads += 1; return reads * 10 }
      val failed: Int get() = error("bad getter")
    }
  `));
  const owner = ok(s.create('Inspection', '', 'example'));
  const field = name => ok(s.inspect(owner.objectId)).fields.find(field => field.name === name);
  for (const [name, text] of [['number', '42'], ['text', 'hello'], ['flag', 'true'], ['numbers', '[1, 2]'], ['label', 'shown label'], ['calculated', '10']]) {
    assert.equal(ok(s.inspectGet(owner.objectId, name)).display, text);
    assert.equal(field(name).value, text);
    assert.equal(field(name).inspectable, true);
    const opened = ok(s.inspectField(owner.objectId, name));
    assert(opened.objectId, `${name} has an inspection handle`);
    if (['number', 'text', 'flag', 'calculated'].includes(name)) assert.equal(opened.display, text);
  }
  assert.equal(evaluate(s, 'example.reads').display, '1');
  assert.equal(evaluate(s, 'example.label.textReads').display, '1', 'Navigation and snapshots do not repeat toString');
  assert.equal(fail(s.inspectGet(owner.objectId, 'broken')).display, 'IllegalStateException: bad text');
  assert.equal(field('broken').inspectable, true);
  assert.equal(field('broken').reference, true);
  assert.equal(ok(s.inspectField(owner.objectId, 'broken')).className, 'Broken');
  assert.equal(fail(s.inspectGet(owner.objectId, 'failed')).display, 'IllegalStateException: bad getter');
  assert.equal(field('failed').inspectable, false);
  ok(s.inspectGet(owner.objectId, 'absent'));
  assert.equal(field('absent').inspectable, false);
  fail(s.inspectField(owner.objectId, 'absent'));
  const oldNumber = ok(s.inspectField(owner.objectId, 'number'));
  evaluate(s, 'example.number = 43');
  assert.equal(field('number').value, '43', 'A changed backing value invalidates its old text');
  assert.equal(ok(s.inspectField(owner.objectId, 'number')).display, '43');
  fail(s.inspect(oldNumber.objectId));
}
// GUI-149: default object text never suggests a nonexistent no-argument constructor.
// Metadata distinguishes it from student strings; generated/inherited text remains intact.
{
  const s = api.bluekCreateKotliteSession();
  ok(s.load('ObjectText.kt', `
    class Plain(val number: Int)
    open class Named { override fun toString() = "custom text" }
    class Inherited : Named()
    class ConstructorText { override fun toString() = "Plain()" }
    class MarkerText { override fun toString() = "<object> : Plain" }
    data class Point(val x: Int)
    enum class Direction { NORTH, SOUTH }
    class Holder {
      val plain = Plain(3)
      val inherited = Inherited()
      val constructorText = ConstructorText()
      val marker = MarkerText()
      val point = Point(4)
      val direction = Direction.NORTH
      val text = "<object> : Plain"
      val computed: Plain get() = plain
      val missing: Plain? = null
    }
  `));
  const holder = ok(s.create('Holder', '', 'holder'));
  const plain = evaluate(s, 'holder.plain');
  assert.equal(plain.display, '<object> : Plain');
  assert.equal(plain.defaultObjectDisplay, true);
  const fields = () => ok(s.inspect(holder.objectId)).fields;
  assert.equal(fields().find(field => field.name === 'plain').defaultObjectDisplay, true);
  for (const name of ['plain', 'computed']) {
    assert.equal(ok(s.inspectGet(holder.objectId, name)).defaultObjectDisplay, true);
    const field = fields().find(field => field.name === name);
    assert.equal(field.value, '<object> : Plain');
    assert.equal(field.defaultObjectDisplay, true);
    assert.equal(field.inspectable, true);
    assert.equal(ok(s.inspectField(holder.objectId, name)).className, 'Plain');
  }
  for (const [name, expected] of [['inherited', 'custom text'], ['constructorText', 'Plain()'], ['marker', '<object> : Plain'], ['point', 'Point(x=4)'], ['direction', 'NORTH'], ['text', '<object> : Plain'], ['missing', 'null']]) {
    const result = ok(s.inspectGet(holder.objectId, name));
    assert.equal(result.display, expected);
    assert.notEqual(result.defaultObjectDisplay, true);
    assert.equal(fields().find(field => field.name === name).defaultObjectDisplay, false);
  }
  assert.equal(evaluate(s, 'listOf(holder.plain).toString()').display, '[<object> : Plain]');
  assert.equal(evaluate(s, 'holder.plain.toString()').display, '<object> : Plain');
  evaluate(s, 'println(holder.plain)');
  assert.equal(s.takeOutput(), '<object> : Plain\n');
  assert.equal(evaluate(s, 'IllegalStateException("failure").toString()').display, 'IllegalStateException: failure');
}
console.log('Reference lifetime regressions passed.');
