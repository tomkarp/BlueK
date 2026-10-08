import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
import { compileModule } from 'svelte/compiler';
import ts from 'typescript';

// Compile the real rune modules, rather than replacing reactivity with a stub.
const entry = '\0workspace-test';
const bundle = await rolldown({
  input: entry,
  resolve: { conditionNames: ['browser', 'import', 'default'] },
  plugins: [{
    name: 'workspace-runes',
    resolveId(id) { if (id === entry) return id; },
    load(id) {
      if (id === entry) return `
        export { ObjectWorkspace } from '${new URL('../frontend/src/workspace/ObjectWorkspace.svelte.ts', import.meta.url).pathname}';
        export { WorkspaceUi } from '${new URL('../frontend/src/workspace/WorkspaceUi.svelte.ts', import.meta.url).pathname}';
        export { ProjectWorkspace } from '${new URL('../frontend/src/workspace/ProjectWorkspace.svelte.ts', import.meta.url).pathname}';
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
const { ObjectWorkspace, WorkspaceUi, ProjectWorkspace } = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

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
    reportCallError: message => { throw new Error(message); },
  };
  return { ui, objects: new ObjectWorkspace({
    ui: () => ui, session: () => session, play: () => ({ showWorld() {} }),
    editor: () => ({ hasWindows: false }), terminal: () => ({ terminalOpen: false }),
  }) };
};
const first = make(), second = make();
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
const project = new ProjectWorkspace({
  tests: () => ({ async loadDefaultFixture() {} }),
  objects: () => ({ dismissMenu() {} }),
  session: () => ({ markUncompiled() {}, sourceEdited() {} }),
  ui: () => first.ui,
  editor: () => ({ openEditor() {}, removeFile() {} }),
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
project.deleteFile(project.files[0]);
assert.equal(project.files.find(file => file.id === attached.id).testTarget, undefined, 'Deleting the parent frees its attached test card');
project.deleteFile(project.files.find(file => file.id === attached.id));
assert.equal(project.defaultTestClass, '', 'Deleting the default test clears the setting');
assert.equal(project.canShareState, false, 'A deleted default class disables the link option');
console.log('Workspace controllers passed: real Svelte reactivity, cloneable arguments, independent instances, stale replies, cancelled inspections and test-card rename/duplicate/delete.');
