import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rolldown } from 'rolldown';

// Exercise the real Tauri SDK, including onCloseRequested's internal destroy
// call, against the permissions shipped by BlueK. No native window is mocked
// as successfully closed unless that SDK call is authorized.
const capability = JSON.parse(await readFile('src-tauri/capabilities/default.json', 'utf8'));
const callbacks = new Map(), listeners = [], calls = [];
let next = 0;
globalThis.window = {
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: 'main' } },
    transformCallback(callback) { callbacks.set(++next, callback); return next; },
    async invoke(command, args) {
      calls.push({ command, args });
      if (command === 'plugin:event|listen') {
        listeners.push(args);
        return listeners.length;
      }
      if (command === 'plugin:window|destroy') {
        assert(capability.permissions.includes('core:window:allow-destroy'),
          'Tauri close listeners need destroy permission to complete a close');
      }
    },
  },
};
const bundle = await rolldown({ input: 'frontend/src/desktopFiles.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const desktop = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));
let dirty = false, prompts = 0;
await desktop.listenForDesktopCloseRequest(() => dirty, () => prompts++);
const close = listeners.find(item => item.event === 'tauri://close-requested');
const request = () => callbacks.get(close.handler)({ event: close.event, id: 1, payload: null });
await request();
assert.equal(calls.filter(call => call.command === 'plugin:window|destroy').length, 1);
dirty = true;
await request();
assert.equal(prompts, 1);
assert.equal(calls.filter(call => call.command === 'plugin:window|destroy').length, 1,
  'Modified work stays open until approved');
await desktop.closeDesktopWindow();
await request();
assert.equal(calls.filter(call => call.command === 'plugin:window|destroy').length, 2,
  'Approved close must finish, rather than reopening the prompt');

const received = [];
await desktop.listenForDesktopProject(path => received.push(path));
const opened = listeners.find(item => item.event === 'bluek://open-project');
assert.deepEqual(opened.target, { kind: 'Window', label: 'main' });
callbacks.get(opened.handler)({ payload: { path: 'other.bluek', windowLabel: 'other' } });
callbacks.get(opened.handler)({ payload: { path: 'mine.bluek', windowLabel: 'main' } });
assert.deepEqual(received, ['mine.bluek']);
for (const template of ['empty', 'empty-blueplay', 'blueplay']) {
  await desktop.openNewProjectWindow(template);
  const create = calls.findLast(call => call.command === 'plugin:webview|create_webview_window');
  assert.equal(new URL(create.args.options.url, 'http://bluek.local/').searchParams.get('bluekNewProject'), template,
    'The chosen template is transferred to the new window');
}
console.log('Desktop lifecycle: SDK close/permissions, discard, targeted delivery and template transfer passed.');

const feedbackBundle = await rolldown({
  input: 'frontend/src/feedbackApi.ts',
  transform: { define: { 'import.meta.env.VITE_BLUEK_API_URL': '""' } },
});
const feedbackOutput = await feedbackBundle.generate({ format: 'esm' });
await feedbackBundle.close();
const { feedbackAvailable, sendFeedback } = await import('data:text/javascript;base64,' +
  Buffer.from(feedbackOutput.output[0].code).toString('base64'));
for (const [location, apiOrigin] of [
  ['tauri://localhost', 'https://api.bluek.online'],
  ['http://tauri.localhost', 'https://api.bluek.online'],
  ['http://localhost:5173', 'http://localhost:5173'],
]) {
  window.location = new URL(location);
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push(url);
    if (options.method === 'POST') {
      const report = JSON.parse(options.body);
      return Response.json({ reference: report.id, queued: false, issueNumber: 12 });
    }
    return Response.json({ available: true });
  };
  assert.equal(await feedbackAvailable(), true);
  assert.equal((await sendFeedback({ id: 'test' })).issueNumber, 12);
  assert.deepEqual(requests, [`${apiOrigin}/api/feedback/config`, `${apiOrigin}/api/feedback`]);
}
console.log('Desktop feedback: availability and submission use the correct API origin.');

let updateRequested = false;
await desktop.listenForDesktopUpdateRequest(() => { updateRequested = true; });
const updateListener = listeners.find(item => item.event === 'bluek://check-update');
assert.deepEqual(updateListener.target, { kind: 'Window', label: 'main' });
callbacks.get(updateListener.handler)({ payload: null });
assert.equal(updateRequested, true);
const messages = { title: 'Update', unavailable: '', current: '', confirm: 'Install {0}?', failed: '' };
await desktop.checkDesktopUpdate(messages);
assert.deepEqual(calls.at(-1), { command: 'check_desktop_update', args: { messages } });
await desktop.cancelDesktopUpdateClose();
assert.equal(calls.at(-1).command, 'cancel_desktop_update_close');

const artifacts = await mkdtemp(join(tmpdir(), 'bluek-update-'));
try {
  const { version } = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
  const assets = [
    ['darwin-aarch64', `BlueK_${version}_macOS_AppleSilicon.app.tar.gz`],
    ['windows-x86_64-msi', `msi/BlueK_${version}_Windows_x64.msi`],
    ['windows-x86_64-nsis', `nsis/BlueK_${version}_Windows_x64_Setup.exe`],
  ];
  await Promise.all(['nsis', 'msi'].map(dir => mkdir(join(artifacts, dir))));
  const signature = platform => Buffer.from(`trusted comment: ${platform}\tversion:${version}`).toString('base64');
  for (const [platform, file] of assets) {
    await writeFile(join(artifacts, file), 'package');
    await writeFile(join(artifacts, `${file}.sig`), `${signature(platform)}\n`);
  }
  const manifestPath = join(artifacts, 'latest.json');
  execFileSync(process.execPath, ['scripts/build-desktop-update-manifest.mjs',
    join(artifacts, assets[0][1]), artifacts, manifestPath]);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.version, version);
  for (const [platform, file] of assets) {
    assert.deepEqual(manifest.platforms[platform], {
      url: `https://github.com/tomkarp/BlueK/releases/download/${platform === 'darwin-aarch64' ? 'bluek-desktop-updates' : `bluek-v${version}`}/${file.split('/').at(-1)}`,
      signature: signature(platform),
    });
  }
} finally {
  await rm(artifacts, { recursive: true, force: true });
}
console.log('Desktop updates: targeted menu event, update IPC and platform manifest passed.');
