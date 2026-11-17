import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'frontend/src/codepadFlow.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { executeCodepad } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
const files = [{ id: 'f1', fileName: 'Main.kt', kind: 'class', source: '', revision: 1 }];
const response = { kind: 'scalar', display: '1' };
let snapshot = { generationId: '', phase: 'uncompiled' };
let compileCalls = 0;
const client = {
  getSnapshot: () => snapshot,
  compile: async () => { compileCalls++; snapshot = { generationId: 'g1', phase: 'ready' }; return { generationId: 'g1', sourceRevision: 1, classes: [], diagnostics: [] }; },
  execute: async () => response,
};
assert.deepEqual(await executeCodepad(client, files, 1, '1'), { kind: 'response', generationId: 'g1', response });
assert.equal(compileCalls, 1, 'Uncompiled codepad execution compiles once');
snapshot = { generationId: 'g1', phase: 'ready' };
assert.deepEqual(await executeCodepad(client, files, 1, '2'), { kind: 'response', generationId: 'g1', response });
assert.equal(compileCalls, 1, 'Ready codepad execution does not compile again');
const failed = { ...client, getSnapshot: () => ({ generationId: '', phase: 'uncompiled' }), compile: async () => ({ generationId: '', sourceRevision: 1, classes: [], diagnostics: [{ severity: 'error', line: 1, column: 1, message: 'bad' }] }) };
assert.equal((await executeCodepad(failed, files, 1, 'bad')).kind, 'compile-error');
let resolve;
const stale = { ...client, getSnapshot: () => snapshot, execute: () => new Promise(r => { resolve = r; }) };
snapshot = { generationId: 'g1', phase: 'ready' };
const pending = executeCodepad(stale, files, 1, '3');
snapshot = { generationId: 'g2', phase: 'uncompiled' };
resolve(response);
assert.equal((await pending).kind, 'stale', 'A replaced generation cannot update codepad history');
console.log('Codepad flow passed: compile-on-demand, no duplicate compile, typed compile errors, and stale generation discard.');

// Error classification comes from the checked-in interpreter, not UI text matching.
const { readFile } = await import('node:fs/promises');
const { runInThisContext } = await import('node:vm');
runInThisContext(await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8'));
const session = globalThis['bluek-kotlite-browser'].bluekCreateKotliteSession();
const evaluate = source => JSON.parse(session.evaluate('<codepad classification>', source));
assert.notEqual(evaluate('var k = 1').kind, 'error');
for (const source of [
  '5 -',
  '5 +',
  '5 *',
  '5 /',
  '5 %',
  'true &&',
  'false ||',
  '5 ==',
  '5 >',
  '1..',
  'null ?:',
  '!',
  '(5 -)',
  'listOf(5 -)',
  'fun missingOperand() { 5 - }',
  'val absent =',
  'k =',
  'k +=',
  'println(5',
  'fun unfinished() {',
  'fun emptyBody() =',
  'fun defaultMissing(n: Int =)',
  'val fixed = 1; fixed = 2',
  'fun uninitialized(): Int { val value: Int; return value }',
  'fun noReturn(): Int { println(1) }',
  'return 1',
  'break',
  'continue',
  'var k = 2',
  'fun duplicate(a: Int, a: Int) = a',
  'val number: Int = "text"',
  'fun takesInt(n: Int) = n; takesInt("text")',
  'throw IllegalArgumentException("student")',
]) {
  const result = evaluate(source);
  assert.equal(result.kind, 'error', source);
  assert.equal(result.sourceError, true, source);
}
for (const source of [
  'missingKotlinFeature()',
  'typealias Name = String',
  'object : Any() {}',
  '5 - object : Any() {}',
  '5 + 1u',
]) {
  const result = evaluate(source);
  assert.equal(result.kind, 'error', source);
  assert.equal(result.sourceError, false, 'Possible gaps retain feedback: ' + source);
}
assert.equal(evaluate('k').display, '1', 'A rejected duplicate keeps the original binding');
assert.equal(evaluate('(\n5)').display, '5', 'A line break after an opening parenthesis still allows an operand');
console.log('Codepad diagnostics passed: incomplete expressions/tokens, duplicate bindings, val writes, initialization, returns, loop scope, resolved type mismatches and student exceptions are source errors; unresolved calls and unsupported syntax retain feedback.');
