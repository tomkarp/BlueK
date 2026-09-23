import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { rolldown } from 'rolldown';
import { build } from 'vite';
import { chromium, webkit } from 'playwright';
import { embeddedKotlite } from '../frontend/build/embeddedKotlite.mjs';

// 1. The decoder restores exactly what the build compressed.
{
  const bundle = await rolldown({ input: 'frontend/src/embeddedKotlite.ts' });
  const { output } = await bundle.generate({ format: 'esm' });
  await bundle.close();
  const { gunzipBase64 } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
  const text = 'fun main() = println("äöü 🚀")\n'.repeat(1000);
  assert.equal(await gunzipBase64(gzipSync(text).toString('base64')), text);
  await assert.rejects(gunzipBase64(Buffer.from('not gzip').toString('base64')));
}

// 2. The real player worker, built with the embedded Kotlite, runs a project in a
// page opened from file:// — no server, no fetch.
async function iife(entry, name, plugins = []) {
  const [result] = await build({
    configFile: false, logLevel: 'error', plugins,
    build: { write: false, minify: true, lib: { entry, name, formats: ['iife'], fileName: name } },
  });
  return result.output[0].code;
}
const workerSource = await iife('frontend/src/playerRuntimeWorker.ts', 'BlueKPlayerWorker', [embeddedKotlite()]);
assert.ok(!workerSource.includes('bluek-kotlite-browser.js'), 'The player worker never refers to the Kotlite asset');
const clientSource = await iife('frontend/src/localRuntimeClient.ts', 'BlueKRuntime');
const harness = `
  const workerUrl = URL.createObjectURL(new Blob([${JSON.stringify(workerSource)}], { type: 'text/javascript' }));
  const client = new BlueKRuntime.LocalRuntimeClient(() => new Worker(workerUrl));
  let output = '';
  client.onResponse(value => { if (value.output) output += value.output; });
  client.subscribe(() => { if (client.getSnapshot().phase === 'waitingForInput') client.sendInput('Ada'); });
  window.result = (async () => {
    const compiled = await client.compile([
      { id: 'a', fileName: 'Greeter.kt', kind: 'class', revision: 1, source: 'class Greeter(val name: String) {\\n  fun greet() = "Hello, " + name\\n}\\n' },
      { id: 'b', fileName: 'App.kt', kind: 'functions', revision: 1, source: 'fun main() {\\n  println("Name?")\\n  val name = readLine() ?: "?"\\n  Thread.sleep(20)\\n  println(Greeter(name).greet())\\n}\\n' },
    ], 1);
    const main = await client.execute({ op: 'main', fileName: 'App.kt' });
    return { diagnostics: compiled.diagnostics, main: main.kind, output, phase: client.getSnapshot().phase };
  })().catch(error => ({ error: String(error) }));`;
const html = `<!doctype html><meta charset="utf-8"><title>Player worker</title><script>${clientSource.replace(/<\/script/gi, '<\\/script')}</script><script>${harness.replace(/<\/script/gi, '<\\/script')}</script>`;
const directory = await mkdtemp(path.join(os.tmpdir(), 'bluek-player-worker-'));
const file = path.join(directory, 'player-worker.html');
await writeFile(file, html);
try {
  for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await type.launch();
    try {
      const page = await browser.newPage();
      const requests = [];
      page.on('request', request => requests.push(request.url()));
      await page.goto(pathToFileURL(file).href);
      const result = await page.evaluate(() => window.result);
      assert.deepEqual(result, { diagnostics: [], main: 'unit', output: 'Name?\nHello, Ada\n', phase: 'ready' }, name);
      assert.deepEqual(requests.filter(url => !url.startsWith('file:') && !url.startsWith('blob:')), [], `${name} loads nothing from the network`);
      console.log(`${name}: player worker ran from file:// (${Math.round(html.length / 1024)} KB page).`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log('Player worker smoke passed.');
