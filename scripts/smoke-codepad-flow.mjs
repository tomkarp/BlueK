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
