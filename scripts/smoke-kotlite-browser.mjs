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
        open fun increment(step: Int = 1) { value = value + step }
    }
    class Child(value: Int) : Counter(value) {
        override fun increment(step: Int = 1) { super.increment(step); value = value + 1 }
    }
`)), 'load');
const manifest = JSON.parse(session.manifest());
const counterMeta = manifest.classes.find(value => value.name === 'Counter');
const childMeta = manifest.classes.find(value => value.name === 'Child');
if (counterMeta?.constructors[0]?.parameters[0]?.name !== 'value') throw new Error('Kotlite manifest lost the constructor parameter.');
if (counterMeta?.methods[0]?.parameters[0]?.name !== 'step' || !counterMeta.methods[0].parameters[0].hasDefault) throw new Error('Kotlite manifest lost method parameter metadata.');
if (childMeta?.supertypes?.[0]?.classifier !== 'Counter') throw new Error('Kotlite manifest lost superclass metadata.');
const benchObject = expectOk(JSON.parse(session.create('Child', '5', 'bench')), 'bench construction');
if (evaluate('bench.value', 'bench binding').display !== '5') throw new Error('Bench object is not available in the codepad.');
const inheritedInspection = expectOk(JSON.parse(session.inspect(benchObject.objectId)), 'inherited inspection');
if (!inheritedInspection.fields.some(field => field.name === 'value')) throw new Error('Primary-constructor properties were not exposed to inspection.');
evaluate('bench.increment()', 'bench mutation');
if (expectOk(JSON.parse(session.invoke(benchObject.objectId, 'increment', '')), 'host invoke').display !== 'Unit') throw new Error('Host method invocation failed.');
if (evaluate('bench.value', 'host mutation visibility').display !== '9') throw new Error('Host mutation is not visible in the codepad.');
expectOk(JSON.parse(session.set(benchObject.objectId, 'value', '17')), 'inspector setter');
if (evaluate('bench.value', 'inspector mutation visibility').display !== '17') throw new Error('Inspector mutation is not visible in the codepad.');
const expressionObject = expectOk(JSON.parse(session.evaluate('<smoke>', 'Child(6)')), 'object expression result');
if (!expressionObject.objectId || expressionObject.className !== 'Child') throw new Error('A Codepad object expression did not receive a runtime handle.');
expectOk(JSON.parse(session.set(expressionObject.objectId, 'value', '7')), 'expression object setter');
if (JSON.parse(session.inspect(expressionObject.objectId)).kind === 'error' || JSON.parse(session.invoke(expressionObject.objectId, 'increment', '')).kind === 'error') throw new Error('A Codepad expression object handle could not be inspected or invoked.');
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
expectOk(JSON.parse(session.load('<setter inspection>', `
    class SetterOnly {
        var value = 7
            set(next) {
                field = next
            }
    }
`)), 'setter-only inspection load');
const setterOnly = expectOk(JSON.parse(session.create('SetterOnly', '', 'setterOnly')), 'setter-only construction');
const setterInspection = expectOk(JSON.parse(session.inspect(setterOnly.objectId)), 'setter-only inspection');
if (!setterInspection.fields.some(field => field.name === 'value' && field.value === '7')) throw new Error('Inspecting a property with only a custom setter lost its backing-field value.');
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
if (JSON.parse(session.remove(benchObject.objectId)).kind === 'error') throw new Error('Removing a valid object handle failed.');
if (JSON.parse(session.inspect(benchObject.objectId)).kind !== 'error' || JSON.parse(session.invoke(benchObject.objectId, 'increment', '')).kind !== 'error') throw new Error('A removed object handle remained usable.');
expectOk(JSON.parse(session.reset()), 'runtime reset');
if (JSON.parse(session.evaluate('<smoke>', 'first.value')).kind !== 'error') throw new Error('Runtime reset retained an old codepad binding.');

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
const failedPersonInput = JSON.parse(personSession.evaluate('<codepad>', 'p.alter = "not an Int"'));
if (failedPersonInput.kind !== 'error') throw new Error('An invalid follow-up input was not rejected.');
if (personSession.takeOutput() !== '') throw new Error('A failed follow-up input produced an unexpected side effect.');
expectOk(JSON.parse(personSession.evaluate('<codepad>', 'p.sprechen()')), 'method after failed input');
if (personSession.takeOutput() !== 'Hi, ich bin Otto und 42 Jahre alt\n') throw new Error('A failed follow-up input damaged the existing object session.');

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

const nullabilitySession = api.bluekCreateKotliteSession();
const nullabilitySource = 'class MaybeName { var name: String? = null; fun label(): String { return name?.uppercase() ?: "unbenannt" } }';
expectOk(JSON.parse(nullabilitySession.load('<nullability>', nullabilitySource)), 'safe call and Elvis load');
expectOk(JSON.parse(nullabilitySession.evaluate('<nullability>', 'val maybe = MaybeName()')), 'safe call construction');
if (JSON.parse(nullabilitySession.evaluate('<nullability>', 'maybe.label()')).display !== 'unbenannt') throw new Error('Safe-call or Elvis evaluation failed for null.');
expectOk(JSON.parse(nullabilitySession.evaluate('<nullability>', 'maybe.name = "Ada"')), 'nullable property assignment');
if (JSON.parse(nullabilitySession.evaluate('<nullability>', 'maybe.label()')).display !== 'ADA') throw new Error('Safe-call or Elvis evaluation failed for a non-null value.');

const inputError = JSON.parse(nullabilitySession.evaluate('<nullability>', 'readln()'));
if (inputError.kind !== 'error' || !inputError.display.includes('readln is not supported')) throw new Error('Unsupported console input did not produce a clear local-runtime error.');

const languageSession = api.bluekCreateKotliteSession();
if (JSON.parse(languageSession.evaluate('<language>', 'var n = 0; while (n < 3) { n += 1 }; n')).display !== '3') throw new Error('While-loop evaluation failed.');
if (JSON.parse(languageSession.evaluate('<language>', 'var total = 0; for (i in 1..3) { total += i }; total')).display !== '6') throw new Error('For-loop evaluation failed.');
const typeError = JSON.parse(languageSession.evaluate('<language>', 'val number: Int = "wrong"'));
if (typeError.kind !== 'error' || !typeError.display.includes('Expected type is `Int`')) throw new Error('A basic type mismatch was not rejected.');
const visibilitySession = api.bluekCreateKotliteSession();
if (JSON.parse(visibilitySession.load('<visibility>', 'class Secret { private var hidden = 1 }')).kind === 'error') throw new Error('Private property syntax unexpectedly failed.');
const visibilityManifest = JSON.parse(visibilitySession.manifest());
if (visibilityManifest.classes[0].properties[0].visibility !== 'private') throw new Error('Private property visibility was lost in the Kotlite manifest.');
if (JSON.parse(visibilitySession.evaluate('<visibility>', 'val secret = Secret(); secret.hidden')).kind !== 'error') throw new Error('Private property could be read from top-level code.');
if (JSON.parse(visibilitySession.evaluate('<visibility>', 'secret.hidden = 2')).kind !== 'error') throw new Error('Private property could be written from top-level code.');
if (JSON.parse(visibilitySession.evaluate('<visibility>', 'class PrivateReader { fun read(secret: Secret): Int = secret.hidden }')).kind === 'error') throw new Error('Private property could not be read from class code.');
const protectedError = JSON.parse(visibilitySession.load('<visibility>', 'class Protected { protected fun hidden() {} }'));
if (protectedError.kind !== 'error' || !protectedError.display.includes('protected')) throw new Error('Unsupported protected visibility did not produce a clear error.');
const secondaryConstructorError = JSON.parse(visibilitySession.evaluate('<visibility>', 'class Secondary { constructor(value: Int) {} }'));
if (secondaryConstructorError.kind !== 'error' || !secondaryConstructorError.display.includes('Secondary constructors are not supported')) throw new Error('Secondary constructors did not produce a clear local error.');

console.log('Kotlite browser session smoke test passed.');
