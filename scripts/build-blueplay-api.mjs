import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

// The UI consumes immutable library metadata produced by Kotlite, so opening
// documentation never compiles or executes a student's project.
vm.runInThisContext(await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8'));
const session = globalThis['bluek-kotlite-browser'].bluekCreateKotliteSession();
session.configureBluePlay(true, 'blueplay-api-build');
const result = await new Promise(resolve => {
  const started = JSON.parse(session.startLoadProject([], [], 'blueplay', 1, () => {}, value => resolve(JSON.parse(value))));
  if (started.kind === 'error') resolve(started);
});
if (result.kind === 'error') throw new Error(result.display);
const manifest = JSON.parse(session.manifest());
if (manifest.error) throw new Error(manifest.error);
for (const klass of manifest.classes) {
  klass.properties = klass.properties.filter(property => property.visibility === 'public');
  klass.methods = klass.methods.filter(method => method.visibility === 'public');
}
await writeFile(new URL('../frontend/src/bluePlayApi.generated.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
console.log('BluePlay API metadata generated from the interpreter.');
