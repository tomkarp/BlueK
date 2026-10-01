import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'frontend/src/inspectorModel.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { InspectorModel, inspectorFieldText } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
const inspection = () => ({ kind: 'inspect', objectId: 'o1', fields: [
  { name: 'age', value: '1' }, { name: 'tax', value: '<computed>', computed: true },
] });
let snapshot = { generationId: 'first', phase: 'ready', inspections: { o1: inspection() } };
let calls = [], notifications = 0, pending;
const runtime = {
  getSnapshot: () => snapshot,
  execute: command => {
    assert.equal(command.op, 'inspectGet');
    calls.push(command.property);
    const generation = snapshot.generationId;
    return new Promise(resolve => { pending = result => {
      if (snapshot.generationId === generation) {
        const field = snapshot.inspections.o1.fields.find(field => field.name === command.property);
        field.value = result.display;
        field.error = result.kind === 'error' ? result.display : undefined;
      }
      resolve(result);
    }; });
  },
};
const model = new InspectorModel(runtime, () => notifications++);
const settle = async result => { pending(result); await Promise.resolve(); await Promise.resolve(); };
for (let i = 0; i < 3; i++) model.view('o1');
assert.equal(calls.length, 0, 'Rendering must never evaluate a getter');
let refresh = model.refresh('o1');
await model.refresh('o1');
assert.deepEqual(calls, ['age'], 'Concurrent refreshes do not start parallel property reads');
await settle({ kind: 'scalar', display: '2' });
assert.deepEqual(calls, ['age', 'tax'], 'Stored and computed properties use the same inspection path');
await settle({ kind: 'scalar', display: '10' });
assert.deepEqual(calls, ['age', 'tax', 'age'], 'A request during inspection schedules a fresh pass instead of being lost');
await settle({ kind: 'scalar', display: '3' });
await settle({ kind: 'scalar', display: '20' });
await refresh;
assert.equal(model.view('o1').fields[1].value, '20', 'The latest pass replaces stale getter results');
snapshot.inspections.o1.fields[0].value = '3';
assert.equal(model.view('o1').fields[0].value, '3', 'Every displayed value comes directly from the runtime');
snapshot.inspections.o1.fields[1].value = '20';
assert.equal(model.view('o1').fields[1].value, '20', 'There is no separate UI getter cache');
refresh = model.refresh('o1');
snapshot = { ...snapshot, generationId: 'second', inspections: { o1: inspection() } };
await settle({ kind: 'scalar', display: 'STALE' });
await refresh;
assert.equal(model.view('o1').fields[1].value, '…', 'Old generation cannot trigger further property reads');
refresh = model.refresh('o1');
model.forget('o1');
await settle({ kind: 'scalar', display: 'CLOSED' });
await refresh;
assert.equal(calls.at(-1), 'age', 'Closing stops the refresh before another property');
refresh = model.refresh('o1');
await settle({ kind: 'scalar', display: '4' });
await settle({ kind: 'error', display: 'IllegalStateException: Missing world' });
await refresh;
assert.equal(model.view('o1').fields[1].error, 'IllegalStateException: Missing world');
assert.equal(inspectorFieldText({ value: 'hello' }, { classifier: 'String', nullable: true }), '"hello"');
assert.equal(inspectorFieldText({ value: 'null' }, { classifier: 'String', nullable: true }), 'null');
assert(notifications > 0);
console.log('Inspector model passed: runtime-owned values, uniform property reads, deduplication, reset, close and errors.');
