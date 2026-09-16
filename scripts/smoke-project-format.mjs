import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'frontend/src/projectFormat.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { createProjectPayload, projectModelFromPayload, parseProject } = await import(
  'data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'),
);

const files = [{ id: 'f1', path: 'animals', fileName: 'Hund.kt', kind: 'class', source: 'class Hund', revision: 4 }];
const resources = [{ path: 'images/hund.png', data: 'data:image/png;base64,AAAA' }];
const positions = { f1: { x: 42, y: 84 } };
const payload = createProjectPayload(files, resources, positions);
assert.deepEqual(payload.files, [{ path: 'animals', fileName: 'Hund.kt', kind: 'class', source: 'class Hund' }]);
const parsed = parseProject(payload);
assert.deepEqual(parsed.files, [{ path: files[0].path, fileName: files[0].fileName, kind: files[0].kind, source: files[0].source }]);
const legacy = parseProject({ format: 'bluek-project', version: 1, files: [{ id: 'legacy', revision: 7, fileName: 'Alt.kt', source: 'class Alt {}' }] });
assert.deepEqual(legacy.files, [{ path: undefined, fileName: 'Alt.kt', source: 'class Alt {}', kind: undefined }]);
assert.deepEqual(parsed.resources, resources);
assert.deepEqual(parsed.cardPositions, { 'Hund.kt': positions.f1 });
const model = projectModelFromPayload(parsed, index => `loaded-${index}`);
assert.deepEqual(model.files, [{ id: 'loaded-0', path: files[0].path, fileName: files[0].fileName, kind: files[0].kind, source: files[0].source, revision: 1 }]);
assert.deepEqual(model.resources, resources);
assert.deepEqual(model.cardPositions, { 'loaded-0': positions.f1 });

assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'bad.txt', source: '' }] }), /Invalid Kotlin file/);
assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'A.kt', source: '' }, { fileName: 'A.kt', source: '' }] }), /duplicate Kotlin/);
assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'A.kt', source: '' }], resources: [{ path: '../x', data: 'data:image/png;base64,AAAA' }] }), /invalid media/);
console.log('Project format passed: public fields, optional paths, positions/resources, and invalid payload rejection.');
