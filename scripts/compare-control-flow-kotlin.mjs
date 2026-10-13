import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { controlFlowCases, projectFormatCase } from './control-flow-cases.mjs';
const version = spawnSync('kotlinc', ['-version'], { encoding: 'utf8' });
assert.equal(version.status, 0, version.stderr);
console.log((version.stdout + version.stderr).trim());
const directory = await mkdtemp(join(tmpdir(), 'bluek-official-control-flow-'));
let passed = 0;
const requested = new Set(process.argv.slice(2));
try {
  for (const entry of [...controlFlowCases, projectFormatCase]) {
    if (requested.size && !requested.has(entry.id)) continue;
    const filenames = Object.keys(entry.files);
    for (const [name, source] of Object.entries(entry.files)) await writeFile(join(directory, name), source);
    const compiled = spawnSync('kotlinc', [...filenames, '-include-runtime', '-d', 'app.jar'], { cwd: directory, encoding: 'utf8', timeout: 60_000 });
    const messages = compiled.stdout + compiled.stderr;
    if (entry.diagnostic) {
      assert.notEqual(compiled.status, 0, `${entry.id} must fail compilation`);
      const d = entry.diagnostic;
      assert.ok(messages.includes(`${d.fileName}:${d.line}:${d.column}: error: ${d.message}`), `${entry.id}: ${messages}`);
    } else {
      assert.equal(compiled.status, 0, `${entry.id}: ${messages}`);
      const executed = spawnSync('java', ['-jar', 'app.jar'], { cwd: directory, encoding: 'utf8', timeout: 10_000 });
      assert.equal(executed.status, 0, `${entry.id}: ${executed.stderr}`);
      assert.equal(executed.stdout, entry.output ?? `${entry.expected}\n`, entry.id);
    }
    passed++;
    console.log(`${entry.id}: compile ${compiled.status === 0 ? 'OK; run OK' : 'rejected at expected position'}`);
    for (const name of filenames) await rm(join(directory, name));
  }
} finally { await rm(directory, { recursive: true, force: true }); }
if (requested.size) assert.equal(passed, requested.size, 'every requested fixture must exist');
console.log(`Official compiler control-flow comparison passed: ${passed} cases.`);
