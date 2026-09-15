import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'frontend/src/projectFormat.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { createProjectPayload, projectModelFromPayload, parseProject } = await import(
  'data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'),
);

const files = [{ id: 'f1', fileName: 'Hund.kt', kind: 'class', source: 'class Hund', revision: 4 }];
const resources = [{ path: 'images/hund.png', data: 'data:image/png;base64,AAAA' }];
const positions = { f1: { x: 42, y: 84 } };
const payload = createProjectPayload(files, resources, positions);
const parsed = parseProject(payload);
assert.deepEqual(parsed.files, [{ fileName: files[0].fileName, kind: files[0].kind, source: files[0].source, revision: files[0].revision }]);
assert.deepEqual(parsed.resources, resources);
assert.deepEqual(parsed.cardPositions, { 'Hund.kt': positions.f1 });
const model = projectModelFromPayload(parsed, index => `loaded-${index}`);
assert.deepEqual(model.files, [{ ...files[0], id: 'loaded-0' }]);
assert.deepEqual(model.resources, resources);
assert.deepEqual(model.cardPositions, { 'loaded-0': positions.f1 });

assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'bad.txt', source: '' }] }), /Invalid Kotlin file/);
assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'A.kt', source: '' }, { fileName: 'A.kt', source: '' }] }), /duplicate Kotlin/);
assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'A.kt', source: '' }], resources: [{ path: '../x', data: 'data:image/png;base64,AAAA' }] }), /invalid media/);
console.log('Project format passed: typed round-trip, IDs/positions/resources, and invalid payload rejection.');
