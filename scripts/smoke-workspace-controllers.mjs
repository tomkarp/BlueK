import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
import { compileModule } from 'svelte/compiler';
import ts from 'typescript';

// Compile the real rune modules, rather than replacing reactivity with a stub.
const entry = '\0workspace-test';
const bundle = await rolldown({
  input: entry,
  transform: { define: {
    __BLUEK_BUILD_INFO__: JSON.stringify({ version: 'test', revision: 'test', channel: 'local', builtAt: '' }),
    'import.meta.env.VITE_BLUEK_OFFLINE': JSON.stringify('0'),
    'import.meta.env.VITE_BLUEK_API_URL': JSON.stringify(''),
  } },
  resolve: { conditionNames: ['browser', 'import', 'default'] },
  plugins: [{
    name: 'workspace-runes',
    resolveId(id) { if (id === entry) return id; },
    load(id) {
      if (id === entry) return `
        export { ObjectWorkspace } from '${new URL('../frontend/src/workspace/ObjectWorkspace.svelte.ts', import.meta.url).pathname}';
        export { WorkspaceUi } from '${new URL('../frontend/src/workspace/WorkspaceUi.svelte.ts', import.meta.url).pathname}';
        export { ProjectWorkspace } from '${new URL('../frontend/src/workspace/ProjectWorkspace.svelte.ts', import.meta.url).pathname}';
        export { FeedbackWorkspace } from '${new URL('../frontend/src/workspace/FeedbackWorkspace.svelte.ts', import.meta.url).pathname}';
      `;
    },
    transform: {
      order: 'pre',
      handler(code, id) {
        if (id.endsWith('.svelte.ts')) {
          const javascript = ts.transpileModule(code, { compilerOptions: {
            target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
          } }).outputText;
          return { ...compileModule(javascript, { filename: id, generate: 'client', dev: false }).js, moduleType: 'js' };
        }
      },
    },
  }],
});
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { ObjectWorkspace, WorkspaceUi, ProjectWorkspace, FeedbackWorkspace } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

const snapshot = { generationId: 'one', phase: 'ready', references: [], liveObjectIds: [], inspections: {} };
let generation = 'one';
const commands = [];
let pending;
const client = {
  getSnapshot: () => ({ ...snapshot, generationId: generation }),
  execute: async command => {
    // A Worker uses structured clone: Svelte proxies must not escape here.
    commands.push(structuredClone(command));
    if (pending) return new Promise((resolve, reject) => { pending.resolve = resolve; pending.reject = reject; });
    return { kind: 'unit' };
  },
};
const meta = {
  name: 'Counter', typeParameters: ['T'],
  constructors: [{ parameters: [{ name: 'value', type: { displayName: 'Int' } }] }],
};
const make = () => {
  const ui = new WorkspaceUi();
  const session = {
    client, runtime: snapshot, classes: [meta], canExecute: true, history: [],
    executeUserCommand: (command, trigger) => { assert.equal(trigger, "interactive"); return client.execute(command); },
    reportCallError: message => { throw new Error(message); },
  };
  return { ui, session, objects: new ObjectWorkspace({
    ui: () => ui, session: () => session, play: () => ({ showWorld() {} }),
    editor: () => ({ hasWindows: false }), terminal: () => ({ terminalOpen: false }),
  }) };
};
const first = make(), second = make();
first.objects.requestObjectOnBench({ kind: 'object', objectId: 'named', className: 'Counter', name: 's' });
assert.equal(first.objects.objectName, 's', 'Get prefers the supplied Codepad name');
first.objects.requestObjectOnBench({ kind: 'object', objectId: 'named', className: 'Counter' });
assert.equal(first.objects.objectName, 'counter', 'Unnamed returns keep the class-based suggestion');
first.session.history = [{ code: 's', objectId: 'named', className: 'Counter', name: 's' }];
first.session.runtime.liveObjectIds = ['named'];
first.objects.getLastCodepadObject();
assert.equal(first.objects.objectName, 's', 'Getting the last result also preserves the supplied name');
first.session.history = [{ code: 'Counter()', objectId: 'named', className: 'Counter' }];
first.objects.getLastCodepadObject();
assert.equal(first.objects.objectName, 'counter', 'Getting the last result uses the same unnamed fallback');
first.objects.objectNamePrompt = null;
first.session.history = [];
first.session.runtime.liveObjectIds = [];
first.objects.createObject('Counter');
first.objects.createName = 'counter1';
first.objects.createArgs[0] = '7';
first.objects.createTypeArgs[0] = 'Int';
await first.objects.confirmCreate();
assert.deepEqual(commands.pop(), { op: 'create', className: 'Counter', name: 'counter1', args: ['7'], typeArguments: ['Int'] });
assert.equal(second.objects.createDialog, null, 'Separate application instances do not share dialog state');

// Empty argument lists previously reached Worker.postMessage as a proxy too.
meta.typeParameters = [];
meta.constructors[0].parameters = [];
first.objects.createObject('Counter');
first.objects.createName = 'counter2';
await first.objects.confirmCreate();
assert.deepEqual(commands.pop().args, []);

first.objects.invokeObject({ name: 'counter1', className: 'Counter', objectId: 'o1' }, {
  name: 'add', parameters: [{ name: 'amount', type: { displayName: 'Int' } }],
});
first.objects.invokeArgs[0] = '3';
await first.objects.confirmInvoke();
assert.deepEqual(commands.pop(), { op: 'invoke', objectId: 'o1', name: 'add', args: ['3'], typeArguments: [] });

// An old invocation completing after project replacement must not reopen its result.
pending = {};
const invocation = first.objects.executeInvoke({
  object: { name: 'counter1', className: 'Counter', objectId: 'o1' }, method: { name: 'value' },
}, [], []);
generation = 'two';
pending.resolve({ kind: 'scalar', display: 'STALE' });
await invocation;
assert.equal(first.objects.resultDialog, null);
assert.equal(second.ui.error, '');

pending = {};
const inspection = first.objects.executeInspectorCommand({ op: 'inspect', objectId: 'o1' });
await Promise.resolve();
generation = 'three';
pending.reject(new Error('Runtime generation replaced.'));
assert.equal(await inspection, null, 'A replaced UI finishes its cancelled inspector callback quietly');

pending = {};
const transportFailure = first.objects.executeInspectorCommand({ op: 'inspect', objectId: 'o1' });
await Promise.resolve();
pending.reject(new Error('Transport failed'));
await assert.rejects(transportFailure, /Transport failed/, 'A real failure in the current generation is preserved');
const deletedFiles = [];
let invalidations = 0;
const project = new ProjectWorkspace({
  tests: () => ({ async loadDefaultFixture() {} }),
  objects: () => ({ dismissMenu() {} }),
  session: () => ({ markUncompiled() { invalidations++; }, sourceEdited() {} }),
  ui: () => first.ui,
  editor: () => ({ openEditor() {}, removeFile(id) { deletedFiles.push(id); } }),
});
project.files = [{ id: 'hund', fileName: 'Hund.kt', source: 'class Hund', kind: 'class', revision: 1 }];
const attached = project.addTestClass(project.files[0], 'HundTest');
assert.throws(() => project.addTestClass(project.files[0], 'AnotherHundTest'), /already/);
project.setDefaultTestClass('HundTest');
assert.equal(project.canShareState, true, 'A stored default class enables state loading in project links');
project.applyGeneratedSource(attached.id, 'import kotlin.test.*\nclass RenamedTest {}');
assert.equal(project.files.find(file => file.id === attached.id).fileName, 'RenamedTest.kt');
assert.equal(project.defaultTestClass, 'RenamedTest');
project.duplicateFile(project.files.find(file => file.id === attached.id));
assert.equal(project.files.at(-1).testTarget, undefined, 'A duplicate test card is independent');
assert.equal(project.files.at(-1).isTestClass, true);
const deletionWindow = globalThis.window;
const deletePrompts = [];
let allowDelete = false;
globalThis.window = { confirm(message) { deletePrompts.push(message); return allowDelete; } };
try {
  const before = JSON.stringify(project.files);
  const positions = JSON.stringify(project.cardPositions);
  const invalidationsBefore = invalidations;
  project.deleteFile(project.files[0]);
  assert.equal(JSON.stringify(project.files), before, 'Cancelling deletion preserves files and test attachments');
  assert.equal(JSON.stringify(project.cardPositions), positions, 'Cancelling deletion preserves card positions');
  assert.equal(project.defaultTestClass, 'RenamedTest', 'Cancelling deletion preserves the default test');
  assert.equal(invalidations, invalidationsBefore, 'Cancelling deletion keeps the runtime session');
  assert.deepEqual(deletedFiles, [], 'Cancelling deletion keeps editor windows');
  allowDelete = true;
  project.deleteFile(project.files[0]);
  assert.equal(project.files.find(file => file.id === attached.id).testTarget, undefined, 'Deleting the parent frees its attached test card');
  project.deleteFile(project.files.find(file => file.id === attached.id));
  assert.equal(project.defaultTestClass, '', 'Deleting the default test clears the setting');
  assert.equal(project.canShareState, false, 'A deleted default class disables the link option');
  assert.deepEqual(deletePrompts, [
    'Delete the file “Hund.kt” from this project?',
    'Delete the file “Hund.kt” from this project?',
    'Delete the file “RenamedTest.kt” from this project?',
  ]);
  assert.deepEqual(deletedFiles, ['hund', attached.id]);
  assert.equal(invalidations, invalidationsBefore + 2, 'Confirmed deletions invalidate the runtime');
} finally { globalThis.window = deletionWindow; }

// GUI-137: reopening a cancelled report must capture the current complete
// project, including functions/tests/resources and their matching diagnostics.
const previousWindow = globalThis.window;
const previousFetch = globalThis.fetch;
globalThis.window = { location: { origin: 'http://127.0.0.1:5173', hostname: '127.0.0.1' } };
const reports = [];
globalThis.fetch = async (_url, options) => {
  if (options?.method === 'POST') {
    const report = JSON.parse(options.body);
    reports.push(report);
    return Response.json({ reference: report.id, queued: false, issueNumber: 12 });
  }
  return Response.json({ available: true });
};
try {
  project.files = [{ id: 'tier', fileName: 'Tier.kt', kind: 'class', source: 'class Tier', revision: 1 }];
  let context = { diagnostics: [{ fileName: 'Tier.kt', line: 1, column: 1, severity: 'error', message: 'old error' }] };
  const feedback = new FeedbackWorkspace({ project: project.projectPayload, context: () => context, language: () => 'de' });
  feedback.show();
  feedback.summary = 'Delayed val';
  feedback.description = 'Compile error';
  assert.equal(feedback.report().project, undefined, 'Project attachment stays opt-in');
  feedback.includeProject = true;
  feedback.close();
  project.files.push(
    { id: 'main', fileName: 'Main.kt', kind: 'functions', source: 'fun main() { println("new") }', revision: 1 },
    { id: 'test', fileName: 'TierTest.kt', kind: 'class', source: 'class TierTest', isTestClass: true, testTarget: 'Tier.kt', revision: 1 },
  );
  project.readme = 'Project instructions';
  project.resources = [{ path: 'images/a.png', data: 'data:image/png;base64,AA==' }];
  context = { diagnostics: [{ fileName: 'Main.kt', line: 44, column: 13, severity: 'error', message: 'new error' }] };
  feedback.show();
  assert.equal(feedback.summary, 'Delayed val', 'User text survives reopening');
  assert.deepEqual(feedback.report().project, JSON.parse(JSON.stringify(project.projectPayload())));
  assert.deepEqual(feedback.report().context, context, 'Diagnostics are recaptured with the project');
  project.files[1].source = 'fun main() { println("later") }';
  assert.equal(feedback.report().project.files[1].source, 'fun main() { println("new") }', 'Preview and transmission use an isolated snapshot');
  await feedback.send();
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0].project, feedback.report().project, 'The complete previewed project is sent');
  feedback.close();
  project.files = [{ id: 'new', fileName: 'New.kt', kind: 'functions', source: 'fun main() {}', revision: 1 }];
  feedback.show();
  assert.equal(feedback.summary, '');
  assert.equal(feedback.includeProject, false, 'Successful submission resets attachment opt-in');
  assert.deepEqual(feedback.projectSnapshot.files.map(file => file.fileName), ['New.kt']);
} finally {
  globalThis.window = previousWindow;
  globalThis.fetch = previousFetch;
}
console.log('Workspace controllers passed: real Svelte reactivity, cloneable arguments, independent instances, stale replies, cancelled inspections and test-card rename/duplicate/delete.');
console.log('Feedback passed: refreshed complete project/diagnostics, retained draft text, opt-in, isolated preview and matching sent payload.');
