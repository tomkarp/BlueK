import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { controlFlowCases, projectFormatCase } from './control-flow-cases.mjs';
vm.runInThisContext(await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8'));
const api = globalThis['bluek-kotlite-browser'];
async function load(files) {
  const session = api.bluekCreateKotliteSession();
  const result = await new Promise(resolve => {
    const started = JSON.parse(session.startLoadProject(Object.keys(files), Object.values(files), null, 0, () => {}, result => resolve(JSON.parse(result))));
    if (started.kind === 'error') resolve(started);
  });
  return { session, result };
}
let passed = 0;
for (const entry of controlFlowCases) {
  const { session, result } = await load(entry.files);
  if (entry.diagnostic) {
    assert.equal(result.kind, 'error', `${entry.id}: must fail compilation, got ${result.display}`);
    assert.equal(result.phase, 'analysis', entry.id);
    assert.equal(result.diagnostics.length, 1, entry.id);
    const diagnostic = result.diagnostics[0];
    for (const key of ['fileName', 'line', 'column']) assert.equal(diagnostic[key], entry.diagnostic[key], `${entry.id}: ${key}`);
    assert.equal(diagnostic.severity, 'error', entry.id);
    assert.equal(diagnostic.message.split(' at [')[0], entry.diagnostic.message, entry.id);
    assert.equal(session.takeOutput(), '', `${entry.id}: rejected source never executes`);
  } else {
    assert.notEqual(result.kind, 'error', `${entry.id}: ${result.display}`);
    if (entry.query) {
      const value = JSON.parse(session.evaluate('<Codepad>', entry.query));
      assert.notEqual(value.kind, 'error', `${entry.id}: ${value.display}`);
      assert.equal(value.display, entry.expected, entry.id);
    }
    const main = await new Promise(resolve => {
      const started = JSON.parse(session.startMain('Main.kt', () => {}, value => resolve(JSON.parse(value))));
      if (started.kind === 'error') resolve(started);
    });
    assert.notEqual(main.kind, 'error', `${entry.id}: ${main.display}`);
    assert.equal(session.takeOutput(), entry.output ?? `${entry.expected}\n`, entry.id);
  }
  passed++;
  console.log(`${entry.id}: OK`);
}
// Project format has a distinct boundary: Kotlin allows a class and main in
// one file; BlueK requires separate class and functions cards. This valid class
// exercises no missing-return diagnostic, and works as separate project files.
const format = await load(projectFormatCase.files);
assert.equal(format.result.kind, 'error');
assert.equal(format.result.phase, 'analysis');
assert.equal(format.result.diagnostics[0].message, 'A BlueK project file may contain one class or top-level functions and properties, but not both.');
console.log(`BlueK control-flow regression passed: ${passed} semantic cases plus project-format boundary.`);
