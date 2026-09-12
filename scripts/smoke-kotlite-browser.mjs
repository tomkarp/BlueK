import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const bundle = await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8');
vm.runInThisContext(bundle, { filename: 'bluek-kotlite-browser.js' });
const api = globalThis['bluek-kotlite-browser'];
if (!api?.bluekCreateKotliteSession) throw new Error('Kotlite bundle did not expose the BlueK session API.');

const session = api.bluekCreateKotliteSession();
const expectOk = (json, label) => {
  if (json.kind === 'error') throw new Error(`${label}: ${json.display}`);
  return json;
};
const evaluate = (source, label) => expectOk(JSON.parse(session.evaluate('<smoke>', source)), label);

const collectionsSession = api.bluekCreateKotliteSession();
const collectionsEvaluate = (source, label) => expectOk(JSON.parse(collectionsSession.evaluate('<collections>', source)), label);
collectionsEvaluate('val numbers = listOf(1, 2)', 'immutable list construction');
if (collectionsEvaluate('numbers[0]', 'list index access').display !== '1') throw new Error('List index access failed in an incremental session.');
if (collectionsEvaluate('numbers.size', 'list size').display !== '2') throw new Error('List size failed in an incremental session.');
if (collectionsEvaluate('numbers.count { it > 1 }', 'list predicate count').display !== '1') throw new Error('List predicate count failed in an incremental session.');
collectionsEvaluate('val mutableNumbers = mutableListOf(1, 2)', 'mutable list construction');
if (collectionsEvaluate('mutableNumbers.add(3)', 'mutable list add').display !== 'true') throw new Error('Mutable list add failed in an incremental session.');
if (collectionsEvaluate('mutableNumbers[2]', 'mutable list index access').display !== '3') throw new Error('Mutable list mutation was not retained.');

expectOk(JSON.parse(session.load('<project>', `
    open class Counter(var value: Int) {
        open fun increment() { value = value + 1 }
    }
    class Child(value: Int) : Counter(value) {
        override fun increment() { super.increment(); value = value + 1 }
    }
`)), 'load');
const benchObject = expectOk(JSON.parse(session.create('Child', '5', 'bench')), 'bench construction');
if (evaluate('bench.value', 'bench binding').display !== '5') throw new Error('Bench object is not available in the codepad.');
evaluate('bench.increment()', 'bench mutation');
if (expectOk(JSON.parse(session.invoke(benchObject.objectId, 'increment', '')), 'host invoke').display !== 'Unit') throw new Error('Host method invocation failed.');
if (evaluate('bench.value', 'host mutation visibility').display !== '9') throw new Error('Host mutation is not visible in the codepad.');
expectOk(JSON.parse(session.load('<accessors>', `
    class Meter {
        var raw = 0
        var value: Int
            get() = raw
            set(newValue) { raw = newValue }
    }
`)), 'custom accessors load');
evaluate('val meter = Meter()', 'accessor construction');
evaluate('meter.value = 42', 'custom setter');
if (evaluate('meter.value', 'custom getter').display !== '42') throw new Error('Custom property getter/setter did not preserve the value.');
expectOk(JSON.parse(session.load('<inspection>', `
    class Audited {
        var raw = 7
        var value: Int
            get() { println("getter-called"); return raw }
    }
`)), 'inspection accessor load');
const inspected = expectOk(JSON.parse(session.create('Audited', '', 'audited')), 'inspection construction');
session.takeOutput();
const inspection = expectOk(JSON.parse(session.inspect(inspected.objectId)), 'inspection');
if (!inspection.fields.some(field => field.name === 'value' && field.value === '<computed>')) throw new Error('Computed property was not marked during inspection.');
if (session.takeOutput() !== '') throw new Error('Inspecting an object invoked a custom getter.');
evaluate('val first = Child(0)', 'construct first');
evaluate('val alias = first', 'alias');
evaluate('alias.increment()', 'increment through alias');
evaluate('first.value', 'identity check');
if (evaluate('first.value', 'dispatch').display !== '2') throw new Error('Object identity or dynamic dispatch failed.');
evaluate('val second = Child(10)', 'construct second');
if (evaluate('second.value', 'separate state').display !== '10') throw new Error('Instances do not keep separate state.');
evaluate('val immutable = 1', 'val declaration');
const invalid = JSON.parse(session.evaluate('<smoke>', 'immutable = 2'));
if (invalid.kind !== 'error') throw new Error('val reassignment was not rejected.');

const personSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(personSession.load('<person project>', `
    class Person(val name: String) {
        var alter = 0
        var constructions = 0
        init {
            constructions = constructions + 1
            println("constructed")
        }
        fun sprechen() {
            println("Hi, ich bin $name und $alter Jahre alt")
        }
    }
`)), 'person load');
expectOk(JSON.parse(personSession.evaluate('<codepad>', 'val p = Person("Otto")')), 'person construction');
if (personSession.takeOutput() !== 'constructed\n') throw new Error('Constructor side effect was not emitted exactly once.');
expectOk(JSON.parse(personSession.evaluate('<codepad>', 'p.alter = 42')), 'person mutation');
if (personSession.takeOutput() !== '') throw new Error('A separated mutation repeated an earlier side effect.');
expectOk(JSON.parse(personSession.evaluate('<codepad>', 'p.sprechen()')), 'person method call');
if (personSession.takeOutput() !== 'Hi, ich bin Otto und 42 Jahre alt\n') throw new Error('Separated Person inputs did not preserve object state.');
if (JSON.parse(personSession.evaluate('<codepad>', 'p.constructions')).display !== '1') throw new Error('Separated inputs reconstructed the Person object.');

const fieldSession = api.bluekCreateKotliteSession();
expectOk(JSON.parse(fieldSession.load('<field>', `
    class FieldPerson(val name: String) {
        var age = 0
        set(value) { if (value >= 0) { field = value } else { field = 0 } }
        val remaining: Int
            get() = 150 - age
        fun speak() { println("Hi, ich bin $name und $age Jahre alt und habe noch $remaining Jahre") }
    }
`)), 'field accessor load');
expectOk(JSON.parse(fieldSession.evaluate('<codepad>', 'val fp = FieldPerson("Otto")')), 'field accessor construction');
expectOk(JSON.parse(fieldSession.evaluate('<codepad>', 'fp.age = 42')), 'field accessor setter');
const remaining = JSON.parse(fieldSession.evaluate('<codepad>', 'fp.remaining'));
if (remaining.display !== '108') throw new Error('Implicit field getter did not return the backing-field based value.');
expectOk(JSON.parse(fieldSession.evaluate('<codepad>', 'fp.speak()')), 'field accessor method');
if (fieldSession.takeOutput() !== 'Hi, ich bin Otto und 42 Jahre alt und habe noch 108 Jahre\n') throw new Error('Implicit field accessor state was not preserved.');
expectOk(JSON.parse(fieldSession.evaluate('<codepad>', 'fp.age = -1')), 'field accessor validation');
const clampedAge = JSON.parse(fieldSession.evaluate('<codepad>', 'fp.age'));
if (clampedAge.display !== '0') throw new Error('Implicit field setter did not enforce its branch.');

console.log('Kotlite browser session smoke test passed.');
