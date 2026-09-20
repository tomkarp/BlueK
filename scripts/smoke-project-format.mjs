import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

const bundle = await rolldown({ input: 'frontend/src/projectFormat.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const { createProjectPayload, projectModelFromPayload, parseProject } = await import(
  'data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'),
);

const files = [{ id: 'f1', path: 'animals', fileName: 'Hund.kt', kind: 'class', source: 'class Hund', revision: 4 }];
const resources = [{ path: 'images/hund.png', data: 'data:image/png;base64,AAAA' }];
const positions = { f1: { x: 42, y: 84 } };
const payload = createProjectPayload(files, resources, positions);
assert.deepEqual(payload.files, [{ path: 'animals', fileName: 'Hund.kt', kind: 'class', source: 'class Hund' }]);
const parsed = parseProject(payload);
assert.deepEqual(parsed.files, [{ path: files[0].path, fileName: files[0].fileName, kind: files[0].kind, source: files[0].source }]);
const legacy = parseProject({ format: 'bluek-project', version: 1, files: [{ id: 'legacy', revision: 7, fileName: 'Alt.kt', source: 'class Alt {}' }] });
assert.deepEqual(legacy.files, [{ path: undefined, fileName: 'Alt.kt', source: 'class Alt {}', kind: undefined }]);
assert.deepEqual(parsed.resources, resources);
assert.deepEqual(parsed.cardPositions, { 'Hund.kt': positions.f1 });
const model = projectModelFromPayload(parsed, index => `loaded-${index}`);
assert.deepEqual(model.files, [{ id: 'loaded-0', path: files[0].path, fileName: files[0].fileName, kind: files[0].kind, source: files[0].source, revision: 1 }]);
assert.deepEqual(model.resources, resources);
assert.deepEqual(model.cardPositions, { 'loaded-0': positions.f1 });

assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'bad.txt', source: '' }] }), /Invalid Kotlin file/);
assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'A.kt', source: '' }, { fileName: 'A.kt', source: '' }] }), /duplicate Kotlin/);
assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'A.kt', source: '' }], resources: [{ path: '../x', data: 'data:image/png;base64,AAAA' }] }), /invalid media/);

// README.md: exported only when it says something, optional on the way back in.
assert.equal('readme' in createProjectPayload(files, [], {}, undefined, [], ''), false);
assert.equal('readme' in createProjectPayload(files, [], {}, undefined, [], '   \n  '), false);
const described = createProjectPayload(files, [], {}, undefined, [], '# Hunde\n\nEin Projekt.');
assert.equal(described.readme, '# Hunde\n\nEin Projekt.');
assert.equal(projectModelFromPayload(described, index => `loaded-${index}`).readme, '# Hunde\n\nEin Projekt.');
assert.equal(projectModelFromPayload({ format: 'bluek-project', version: 1, files: [{ fileName: 'A.kt', source: '' }] }, index => `loaded-${index}`).readme, '');
assert.throws(() => parseProject({ format: 'bluek-project', version: 1, files: [{ fileName: 'A.kt', source: '' }], readme: 42 }), /invalid README/);

const markdownBundle = await rolldown({ input: 'frontend/src/markdownEditor.ts' });
const markdownOutput = (await markdownBundle.generate({ format: 'esm' })).output;
await markdownBundle.close();
const { markdownMarks } = await import(
  'data:text/javascript;base64,' + Buffer.from(markdownOutput[0].code).toString('base64'),
);
// The README is formatted while it is typed: the text stays Markdown, the marks
// only say what to style and which markers to hide away from the cursor.
const marks = (doc, active = []) => markdownMarks(doc, new Set(active));
const classesOf = (doc, active = []) => marks(doc, active).filter(mark => mark.kind === 'line').map(mark => mark.class);
assert.deepEqual(classesOf('# Titel'), ['cm-md-h1']);
assert.deepEqual(classesOf('### Titel'), ['cm-md-h3']);
assert.deepEqual(classesOf('- eins\n2. zwei\n> drei\n---'), ['cm-md-list', 'cm-md-list', 'cm-md-quote', 'cm-md-rule']);
assert.deepEqual(classesOf('```\nclass Hund\n```'), ['cm-md-code-block cm-md-fence', 'cm-md-code-block', 'cm-md-code-block cm-md-fence']);
// Away from the cursor the `# ` is hidden; on the cursor's line it is editable.
assert.deepEqual(marks('# Titel').filter(mark => mark.kind === 'hidden'), [{ kind: 'hidden', from: 0, to: 2 }]);
assert.deepEqual(marks('# Titel', [1]).filter(mark => mark.kind === 'hidden'), []);
const spans = (doc, active = []) => marks(doc, active).filter(mark => mark.kind === 'span');
assert.deepEqual(spans('Ein **Wort** hier'), [{ kind: 'span', from: 6, to: 10, class: 'cm-md-strong' }]);
assert.deepEqual(spans('Ein `code` hier'), [{ kind: 'span', from: 4, to: 10, class: 'cm-md-code-span' }]);
assert.deepEqual(spans('[BlueK](https://example.org)'), [{ kind: 'span', from: 1, to: 6, class: 'cm-md-link' }]);
// Inside code nothing else counts, and an underscore in a name is not emphasis.
assert.deepEqual(spans('`**roh**`'), [{ kind: 'span', from: 0, to: 9, class: 'cm-md-code-span' }]);
assert.deepEqual(spans('max_wert und min_wert'), []);
assert.deepEqual(marks('- Ente').filter(mark => mark.kind === 'bullet'), [{ kind: 'bullet', from: 0, to: 1 }]);
assert.deepEqual(marks('- Ente', [1]).filter(mark => mark.kind === 'bullet'), []);

// A block is revealed as a whole: standing anywhere in a code block shows the
// fences that say where it ends, and leaving it hides them again.
const block = '```kotlin\nval zahl = 12\n```';
assert.deepEqual(marks(block).filter(mark => mark.kind === 'hiddenLine').map(mark => mark.line), [1, 3]);
assert.deepEqual(marks(block, [2]).filter(mark => mark.kind === 'hiddenLine'), []);
// An empty block keeps them, or there would be no way back into it.
assert.deepEqual(marks('```\n```').filter(mark => mark.kind === 'hiddenLine'), []);
// The same for the lines of one quote: the cursor in the first reveals both.
assert.deepEqual(marks('> eins\n> zwei', [1]).filter(mark => mark.kind === 'hidden'), []);
// Kotlin in a code block is coloured, and the colouring follows the tokens.
const tokens = spans(block, [2]).filter(mark => mark.class.startsWith('cm-md-tok-'));
assert.ok(tokens.some(token => token.class === 'cm-md-tok-keyword' && block.slice(token.from, token.to) === 'val'));
assert.ok(tokens.some(token => token.class === 'cm-md-tok-number' && block.slice(token.from, token.to) === '12'));

// A BlueJ project keeps its description in README.TXT; importing must not lose it.
const importBundle = await rolldown({ input: 'frontend/src/blueJImport.ts' });
const importOutput = (await importBundle.generate({ format: 'esm' })).output;
await importBundle.close();
const { blueJProjectFromEntries } = await import(
  'data:text/javascript;base64,' + Buffer.from(importOutput[0].code).toString('base64'),
);
const bytes = text => new TextEncoder().encode(text);
const blueJ = blueJProjectFromEntries([
  { path: 'Krok/package.bluej', bytes: bytes('target1.name=Hund\ntarget1.x=40\ntarget1.y=60\n') },
  { path: 'Krok/Hund.kt', bytes: bytes('class Hund') },
  { path: 'Krok/README.TXT', bytes: bytes('Projekt: KrokoAlarm\n') },
]);
assert.equal(blueJ.readme, 'Projekt: KrokoAlarm\n');
assert.equal('readme' in blueJProjectFromEntries([{ path: 'Krok/Hund.kt', bytes: bytes('class Hund') }]), false);

console.log('Project format passed: public fields, optional paths, positions/resources, README export/import, BlueJ README.TXT, Markdown formatting marks, and invalid payload rejection.');
