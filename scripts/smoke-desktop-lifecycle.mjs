import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
