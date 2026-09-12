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

console.log('Kotlite browser session smoke test passed.');
