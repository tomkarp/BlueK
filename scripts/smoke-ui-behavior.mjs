import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

// Test the helpers imported by the actual Svelte component, not a reimplementation.
const bundle = await rolldown({ input: 'frontend/src/uiParity.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const ui = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

assert.equal(ui.appendTerminal(ui.appendTerminal('', 'X'), 'Y\n'), 'XY\n');
const transcript = ui.appendTerminal('A\n\u0001Test\u0002\n', 'B\nTest\n');
assert.deepEqual(ui.terminalParts(transcript), [
  { text: 'A\n', input: false }, { text: 'Test', input: true },
  { text: '\nB\nTest\n', input: false },
]);
assert.equal(ui.appendTerminal(transcript, '\fnew'), 'new');
assert.equal(ui.appendTerminal(transcript, 'first\fsecond\ffinal'), 'final');
assert.deepEqual(ui.terminalParts(''), []);
assert.equal(ui.codepadResult({ kind: 'unit' }), undefined);
assert.equal(ui.codepadResult({ kind: 'error' }), undefined);
assert.equal(ui.codepadResult({ kind: 'scalar', type: { displayName: 'String' }, display: 'hello' }), '"hello" : String');
assert.equal(ui.codepadResult({ kind: 'scalar', type: { displayName: 'Int' }, display: '3' }), '3 : Int');
assert.equal(ui.defaultObjectName('Hund'), 'hund1');
assert.equal(ui.defaultObjectName('Hund', ['hund1', 'hund3']), 'hund2');
assert.equal(ui.defaultObjectName('Box<String>', ['box1']), 'box2');
assert.equal(ui.sourceDeclarationName('class Hund { }'), 'Hund');
assert.equal(ui.sourceDeclarationName('interface Tier { }'), 'Tier');
assert.equal(ui.sourceDeclarationName('// empty'), null);

const params = [{ name: 'a', hasDefault: true }, { name: 'b', hasDefault: false }];
assert.equal(ui.missingRequired(params, ['', '2']), false);
assert.equal(ui.missingRequired(params, ['', '']), true);
assert.deepEqual(ui.kotlinCallArguments(params, ['', '2']), ['b = 2']);
assert.deepEqual(ui.kotlinCallArguments(params, ['1', '2']), ['1', '2']);
assert.equal(ui.missingTypeArgument(['Int', '']), true);
assert.equal(ui.codepadIsDisabled('uncompiled'), false);
assert.equal(ui.codepadIsDisabled('ready'), false);
assert.equal(ui.codepadIsDisabled('compiling'), true);
assert.equal(ui.codepadIsDisabled('running'), true);
assert.equal(ui.codepadIsDisabled('waitingForInput'), true);
assert.equal(ui.codepadIsDisabled('ready', true), true);
const child = '// comment\nclass Hund(val name: String) {\n}\n';
const inherited = ui.addSuperclass(child, 'Tier');
assert.equal(inherited, '// comment\nclass Hund(val name: String) : Tier() {\n}\n');
assert.equal(ui.sourceSuperclass(inherited), 'Tier');
assert.equal(ui.addSuperclass(inherited, 'Tier'), inherited);
assert.equal(ui.sourceSuperclass('class Solo {}'), null);
const rect = { left: 10, top: 20, width: 100, height: 60 };
assert.deepEqual(ui.cardBorderPoint(rect, ui.cardCenter(rect), { x: 260, y: 50 }), { x: 110, y: 50 });
const generic = { name: 'echo', parameters: [{ name: 'value', type: { classifier: 'T', displayName: 'T' } }], returnType: { classifier: 'T', displayName: 'T' } };
const specialized = ui.specializeCallable(generic, { className: 'Box<List<String>>' }, [{ name: 'Box', typeParameters: ['T'] }]);
assert.equal(specialized.parameters[0].type.displayName, 'List<String>');
assert.equal(specialized.returnType.displayName, 'List<String>');
assert.equal(generic.parameters[0].type.displayName, 'T');

globalThis.window = globalThis;
const project = { format: 'bluek-project', version: 1, files: [{ fileName: 'Hund.kt', source: child }] };
const link = await ui.encodeBlueKLink(project);
assert.match(link, /^(d1|p1)\./);
assert.deepEqual(await ui.decodeBlueKLink(link), project);
const plain = 'p1.' + Buffer.from(JSON.stringify(project)).toString('base64url');
assert.deepEqual(await ui.decodeBlueKLink(plain), project);
const decompressor = globalThis.DecompressionStream;
delete globalThis.DecompressionStream;
try { assert.deepEqual(await ui.decodeBlueKLink(link), project); }
finally { globalThis.DecompressionStream = decompressor; }
await assert.rejects(ui.decodeBlueKLink('unknown.version'));
console.log('Svelte UI behavior tests passed: terminal, codepad, arguments, inheritance, generics, project links.');
