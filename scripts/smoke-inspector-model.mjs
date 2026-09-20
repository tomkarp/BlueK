import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'frontend/src/inspectorModel.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { InspectorModel, inspectorFieldText } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
const inspection = () => ({ kind: 'inspect', objectId: 'o1', fields: [
  { name: 'age', value: '1' }, { name: 'tax', value: '<computed>' },
] });
let snapshot = { generationId: 'first', phase: 'ready', inspections: { o1: inspection() } };
let calls = 0, notifications = 0;
let pending;
const runtime = {
  getSnapshot: () => snapshot,
  execute: command => {
    assert.deepEqual(command, { op: 'get', objectId: 'o1', property: 'tax' });
    calls++;
    return new Promise(resolve => { pending = resolve; });
  },
};
const model = new InspectorModel(runtime, () => notifications++);
for (let i = 0; i < 3; i++) model.view('o1');
assert.equal(calls, 0, 'Rendering must never evaluate a getter');
let refresh = model.refresh('o1');
await model.refresh('o1');
assert.equal(calls, 1, 'Concurrent refreshes must not evaluate a getter twice');
pending({ kind: 'scalar', display: '10' });
await refresh;
assert.equal(model.view('o1').fields[1].value, '10');
assert.equal(snapshot.inspections.o1.fields[1].value, '<computed>', 'The model must not mutate runtime data');
snapshot.inspections.o1.fields[0].value = '2';
assert.equal(model.view('o1').fields[0].value, '2', 'Stored fields come directly from the runtime');
refresh = model.refresh('o1');
snapshot = { ...snapshot, generationId: 'second', inspections: { o1: inspection() } };
pending({ kind: 'scalar', display: 'STALE' });
await refresh;
assert.equal(model.view('o1').fields[1].value, '<computed>', 'Never apply an old generation to a reused object id');
assert.equal(notifications, 1);
refresh = model.refresh('o1');
model.forget('o1');
pending({ kind: 'scalar', display: 'CLOSED' });
await refresh;
assert.equal(model.view('o1').fields[1].value, '<computed>', 'Closing discards in-flight results');
refresh = model.refresh('o1');
pending({ kind: 'error', display: 'Getter failed' });
await refresh;
assert.equal(model.view('o1').fields[1].error, 'Getter failed', 'Getter failures remain observable');
assert.equal(inspectorFieldText({ value: 'hello' }, { classifier: 'String', nullable: true }), '"hello"');
assert.equal(inspectorFieldText({ value: 'null' }, { classifier: 'String', nullable: true }), 'null');
console.log('Inspector model passed: pure projection, live stored values, deduplication, reset, close, errors, nullable strings.');
