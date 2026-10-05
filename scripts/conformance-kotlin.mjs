// Runs official Kotlin compiler tests (JetBrains/kotlin, compiler/testData/codegen/box) of the
// areas school Kotlin uses through the BlueK interpreter. Each test file declares
// `fun box(): String` and passes when it returns "OK". Like minikotlin's coverage page, but
// limited to the areas below, and used to find wrong results rather than to chase a figure.
//
//   npm run test:conformance            fails when a test of the baseline no longer passes
//   npm run test:conformance -- --report  lists results by area and the most frequent failures
//   npm run test:conformance -- --update  rewrites the baseline after an intended improvement
//
// The tests are fetched once (sparse, one pinned commit) into `.cache/kotlin-box`; nothing of
// them is committed. See docs/regression-checklist.md (RT-97).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { Worker } from 'node:worker_threads';

const KOTLIN_COMMIT = 'e5b61f33dedf8f0cd170ed316d321ac837478ffc';
const AREAS = [
  'arrays', 'binaryOp', 'casts', 'classes', 'closures', 'constants', 'controlStructures', 'dataClasses',
  'defaultArguments', 'elvis', 'enum', 'exceptions', 'extensionFunctions', 'finally', 'functions', 'increment',
  'initializers', 'innerNested', 'labels', 'lambda', 'lateinit', 'multiDecl', 'objects', 'operatorConventions',
  'primitiveTypes', 'properties', 'ranges', 'safeCall', 'sealed', 'secondaryConstructors', 'smartCasts',
  'strings', 'super', 'traits', 'try', 'unaryOp', 'vararg', 'when', 'collections',
];
const root = new URL('..', import.meta.url).pathname;
const checkout = `${root}.cache/kotlin-box`;
const boxDir = `${checkout}/compiler/testData/codegen/box`;
const baselineFile = `${root}scripts/conformance-baseline.txt`;
const bundle = process.env.BLUEK_BUNDLE || `${root}frontend/public/kotlite/bluek-kotlite-browser.js`;
const report = process.argv.includes('--report');
const update = process.argv.includes('--update');
const TIMEOUT_MS = 10000;

function git(...args) { execFileSync('git', args, { cwd: checkout, stdio: 'ignore' }); }
if (!existsSync(boxDir)) {
  console.log(`Fetching Kotlin compiler tests ${KOTLIN_COMMIT.slice(0, 10)} into .cache/kotlin-box …`);
  await mkdir(checkout, { recursive: true });
  git('init', '-q');
  git('remote', 'add', 'origin', 'https://github.com/JetBrains/kotlin.git');
  git('config', 'core.sparseCheckout', 'true');
  await writeFile(`${checkout}/.git/info/sparse-checkout`, 'compiler/testData/codegen/box/\n');
  git('fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', KOTLIN_COMMIT);
  git('checkout', '-q', 'FETCH_HEAD');
}

// kotlin.test as plain Kotlin, prepended to the tests that import it.
const kotlinTest = `
fun assertEquals(expected: Any?, actual: Any?, message: String? = null) { if (expected != actual) throw AssertionError("Expected <$expected>, actual <$actual>." + (message?.let { " $it" } ?: "")) }
fun assertNotEquals(illegal: Any?, actual: Any?, message: String? = null) { if (illegal == actual) throw AssertionError("Illegal value: <$actual>." + (message ?: "")) }
fun assertTrue(actual: Boolean, message: String? = null) { if (!actual) throw AssertionError(message ?: "Expected value to be true.") }
fun assertFalse(actual: Boolean, message: String? = null) { if (actual) throw AssertionError(message ?: "Expected value to be false.") }
fun assertNull(actual: Any?, message: String? = null) { if (actual != null) throw AssertionError(message ?: "Expected value to be null, but was: <$actual>.") }
fun <T : Any> assertNotNull(actual: T?, message: String? = null): T { if (actual == null) throw AssertionError(message ?: "Expected value to be not null."); return actual }
fun assertSame(expected: Any?, actual: Any?, message: String? = null) { if (expected !== actual) throw AssertionError(message ?: "Expected same instance.") }
fun fail(message: String? = null): Nothing = throw AssertionError(message ?: "fail")
`;

/** Why a test is outside BlueK's scope: other platforms, several files, compiler flags, reflection, coroutines. */
function outOfScope(source) {
  const reasons = [];
  if (/^\/\/ ?TARGET_BACKEND:/m.test(source)) reasons.push('target backend');
  if (/^\/\/ ?(FILE|MODULE):/m.test(source)) reasons.push('several files');
  if (/^\/\/ ?LANGUAGE:/m.test(source)) reasons.push('language flag');
  if (/^\/\/ ?(WITH_REFLECT|WITH_COROUTINES|FULL_JDK)/m.test(source)) reasons.push('reflection/coroutines/JDK');
  if (/^import (java|javax|kotlin\.reflect|kotlin\.coroutines|kotlin\.jvm|kotlin\.js|kotlin\.wasm|kotlin\.concurrent)\b/m.test(source)) reasons.push('platform import');
  if (/@Jvm[A-Z]|@kotlin\.jvm|java\.lang|::class\.java|\bSystem\./.test(source)) reasons.push('JVM API');
  if (/\bsuspend\b|\bcoroutine/i.test(source)) reasons.push('coroutines');
  if (/@JsName|@JsExport|\bjs\(/.test(source)) reasons.push('JS API');
  if (!/\bfun box\(\)/.test(source)) reasons.push('no box()');
  return reasons;
}

// BlueK has no packages; `kotlin.test` comes from the prelude above.
function prepare(source) {
  const usesKotlinTest = /^import kotlin\.test/m.test(source);
  const text = source.replace(/^package .*$/m, '').replace(/^import kotlin\.test.*$/mg, '');
  return (usesKotlinTest ? kotlinTest : '') + text + '\nbox()\n';
}

async function kotlinFiles(dir, prefix) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await kotlinFiles(`${dir}/${entry.name}`, path));
    else if (entry.name.endsWith('.kt')) result.push(path);
  }
  return result;
}

const files = (await Promise.all(AREAS.map(area => kotlinFiles(`${boxDir}/${area}`, area)))).flat().sort();
const results = new Map();
const queue = [];
for (const file of files) {
  const source = await readFile(`${boxDir}/${file}`, 'utf8');
  const reasons = outOfScope(source);
  if (reasons.length) results.set(file, { status: 'out of scope', detail: reasons.join(', ') });
  else queue.push({ file, code: prepare(source) });
}

// Each test runs in a fresh session in a worker, so that an endless loop can be stopped.
const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const module = { exports: {} };
new Function('module', 'exports', 'define', fs.readFileSync(workerData.bundle, 'utf8'))(module, module.exports, undefined);
parentPort.on('message', code => {
  let result;
  try { result = JSON.parse(module.exports.bluekCreateKotliteSession().evaluate('<box>', code)); }
  catch (error) { result = { kind: 'error', display: 'host: ' + String(error) }; }
  parentPort.postMessage({ kind: result.kind, display: String(result.display ?? '').slice(0, 300) });
});
parentPort.postMessage('ready');
`;
let next = 0;
async function runWorker() {
  let worker, pending;
  const start = () => new Promise(resolve => {
    worker = new Worker(workerSource, { eval: true, workerData: { bundle }, resourceLimits: { maxOldGenerationSizeMb: 512 } });
    worker.on('message', message => { if (message === 'ready') resolve(); else pending?.(message); });
    worker.on('error', error => pending?.({ kind: 'error', display: 'host: ' + String(error) }));
  });
  await start();
  while (next < queue.length) {
    const { file, code } = queue[next++];
    const outcome = await new Promise(resolve => {
      const timer = setTimeout(() => resolve({ kind: 'timeout', display: '' }), TIMEOUT_MS);
      pending = message => { clearTimeout(timer); resolve(message); };
      worker.postMessage(code);
    });
    pending = null;
    if (outcome.kind === 'timeout' || outcome.display.startsWith('host: ')) { await worker.terminate(); await start(); }
    const status = outcome.kind === 'timeout' ? 'timeout'
      : outcome.kind === 'error' ? 'error'
      : outcome.display === 'OK' ? 'pass' : 'wrong result';
    results.set(file, { status, detail: outcome.display });
  }
  await worker.terminate();
}
await Promise.all(Array.from({ length: Math.max(2, os.cpus().length - 2) }, runWorker));

const count = status => [...results.values()].filter(r => r.status === status).length;
const inScope = results.size - count('out of scope');
console.log(`${files.length} tests in ${AREAS.length} areas, ${inScope} in scope: ${count('pass')} pass, ${count('wrong result')} wrong result, ${count('error')} error, ${count('timeout')} timeout`);

if (report) {
  const areas = new Map();
  for (const [file, { status }] of results) {
    const area = areas.get(file.split('/')[0]) ?? { pass: 0, scope: 0 };
    if (status !== 'out of scope') area.scope++;
    if (status === 'pass') area.pass++;
    areas.set(file.split('/')[0], area);
  }
  console.log([...areas].map(([name, { pass, scope }]) => `${name} ${pass}/${scope}`).join(' · '));
  console.log('\nWrong results:');
  for (const [file, r] of results) if (r.status === 'wrong result') console.log(`  ${file}: ${r.detail}`);
  const reasons = new Map();
  for (const [file, r] of results) {
    if (r.status !== 'error') continue;
    const key = r.detail.split('\n')[0].replace(/ at \[<.*$/, '').replace(/`[^`]*`/g, '`…`').replace(/\d+/g, 'N').slice(0, 100);
    reasons.set(key, [...(reasons.get(key) ?? []), file]);
  }
  console.log('\nMost frequent errors:');
  [...reasons].sort((a, b) => b[1].length - a[1].length).slice(0, 40)
    .forEach(([key, list]) => console.log(`  ${String(list.length).padStart(4)} ${key}  (${list[0]})`));
}

const passing = [...results].filter(([, r]) => r.status === 'pass').map(([file]) => file);
if (update) {
  await writeFile(baselineFile, passing.join('\n') + '\n');
  console.log(`Baseline updated: ${passing.length} tests.`);
} else if (!report) {
  const baseline = (await readFile(baselineFile, 'utf8')).split('\n').filter(Boolean);
  const lost = baseline.filter(file => results.get(file)?.status !== 'pass');
  if (lost.length) {
    throw new Error(`Kotlin conformance: ${lost.length} baseline tests no longer pass:\n` +
      lost.map(file => `  ${file}: ${results.get(file)?.status} ${results.get(file)?.detail ?? ''}`).join('\n'));
  }
  const gained = passing.filter(file => !baseline.includes(file));
  console.log(`Kotlin conformance passed: all ${baseline.length} baseline tests pass` +
    (gained.length ? `; ${gained.length} more pass now (npm run test:conformance -- --update)` : '') + '.');
}
