import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
import { validateProject, validateProgram } from '../server/project-validation.mjs';
const entry = '\0publication-policy';
const bundle = await rolldown({ input: entry, plugins: [{ name: 'publication-policy',
  resolveId(id) { if (id === entry) return id; },
  load(id) { if (id === entry) return `export { checkServerProject, publicationProject } from '${new URL('../frontend/src/apiClient.ts', import.meta.url).pathname}'; export { standardResources } from '${new URL('../frontend/src/standardImages.ts', import.meta.url).pathname}';`; },
}] });
const { output } = await bundle.generate({ format: 'esm' }); await bundle.close();
const { checkServerProject, publicationProject, standardResources } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
const project = { format: 'bluek-project', version: 1, library: { id: 'blueplay', version: 1 }, files: [{ fileName: 'Main.kt', source: 'fun main() { World(100, 100, 1).show() }' }] };
const program = project => ({ format: 'bluek-program', version: 1, project, mainFile: 'Main.kt', blueKUrl: 'https://bluek.online/' });
assert.ok(standardResources.length >= 42);
for (const standard of standardResources) {
  const resource = { path: standard.path, data: standard.data };
  const payload = { ...project, resources: [resource] };
  const original = JSON.stringify(payload);
  assert.deepEqual(validateProject(payload, true).resources, []);
  assert.deepEqual(validateProgram(program(payload)).project.resources, []);
  assert.deepEqual(publicationProject(payload).resources, []);
  assert.equal(JSON.stringify(payload), original, 'Public normalization leaves local/private source intact');
  const fake = { ...payload, resources: [{ ...resource, data: resource.data + 'AAAA' }] };
  assert.throws(() => validateProject(fake, true), error => error.status === 422 && error.details.resources[0] === resource.path);
  assert.throws(() => publicationProject(fake), error => error.reason === 'custom-media' && error.details.resources[0] === resource.path);
  assert.doesNotThrow(() => validateProject(fake), 'Own resources remain private');
  assert.doesNotThrow(() => checkServerProject(fake), 'Private client save still permits own resources');
}
assert.throws(() => validateProject({ ...project, resources: [{ path: 'images/apple.png', data: 'https://example.org/apple.png' }] }, true));
assert.throws(() => checkServerProject({ ...project, readme: '😀'.repeat(270000) }), error => error.reason === 'too-large');
console.log(`Publication media policy passed: all ${standardResources.length} shipped images/sounds accepted by verified content and referenced from the library, same-name counterfeits rejected on client/server, private originals intact, UTF-8 limit.`);
