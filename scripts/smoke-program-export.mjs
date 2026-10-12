import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';
import { chromium } from 'playwright';

const bundle = await rolldown({ input: 'frontend/src/programExport.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const {
  PROGRAM_ELEMENT_ID, PROGRAM_PLACEHOLDER, PUBLIC_BLUEK_URL, blueKUrlForExport, createExportedProgram,
  embedProgram, exportFileName, parseEmbeddedProgram, parseExportedProgram, programScriptText,
} = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

// Sources that would end the script element, open a comment or break older JS parsers.
const hostile = 'fun main() {\n  println("</script><script>alert(1)</script> <!-- & \u2028 \u2029 ü 🚀")\n}\n';
const project = {
  format: 'bluek-project', version: 1, projectName: 'Mein <Spiel>',
  files: [
    { fileName: 'Rocket.kt', kind: 'class', source: 'class Rocket' },
    { fileName: 'App.kt', kind: 'functions', source: hostile },
  ],
  resources: [{ path: 'images/rocket.png', data: 'data:image/png;base64,AAAA' }],
};
const program = createExportedProgram(project, 'App.kt', 'https://bluek.online/app/?x=1#y');
assert.equal(program.format, 'bluek-program');
assert.equal(program.mainFile, 'App.kt');
assert.equal(program.blueKUrl, 'https://bluek.online/app/', 'Query and hash never reach the link base');
assert.equal(program.project.files[1].source, hostile);

// JSON drops the undefined optional fields a parsed project keeps.
const json = value => JSON.parse(JSON.stringify(value));
const text = programScriptText(program);
assert.doesNotMatch(text, /[<>&\u2028\u2029]/, 'Script text contains no markup characters');
assert.deepEqual(JSON.parse(text), json(program), 'Escaped JSON is the same value');

// Round trip through a browser's HTML parser, as the player reads it.
const template = `<!doctype html><title>BlueK</title>${PROGRAM_PLACEHOLDER}<script>window.ok = 1</script>`;
const html = embedProgram(template, program);
const linksBundle = await rolldown({ input: 'frontend/src/programLinks.ts' });
const linksOutput = await linksBundle.generate({ format: 'esm' });
await linksBundle.close();
const linksModule = 'data:text/javascript;base64,' + Buffer.from(linksOutput.output[0].code).toString('base64');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const dialogs = [];
  page.on('dialog', dialog => { dialogs.push(dialog.message()); return dialog.dismiss(); });
  await page.setContent(html);
  const parsed = await page.evaluate(id => ({
    scripts: document.querySelectorAll('script').length,
    text: document.getElementById(id)?.textContent,
    ok: window.ok,
  }), PROGRAM_ELEMENT_ID);
  assert.equal(parsed.scripts, 2, 'Sources cannot add or close script elements');
  assert.equal(parsed.ok, 1, 'The following script still runs');
  assert.deepEqual(dialogs, [], 'Embedded sources never execute');
  assert.deepEqual(json(parseEmbeddedProgram(parsed.text)), json(program));
  assert.equal(parseEmbeddedProgram(parsed.text).project.files[1].source, hostile);
  const links = await page.evaluate(async ({ moduleUrl, project }) => {
    const { programForLink, fullProgramLink, shortProgramLink } = await import(moduleUrl);
    const program = programForLink(project, 'App.kt', '/BlueK/', 'https://example.github.io/BlueK/', { allowBlueK: false });
    // Exercise the uncompressed fallback as well as the shared URL length guard.
    Object.defineProperty(window, 'CompressionStream', { configurable: true, value: undefined });
    delete window.CompressionStream;
    let largeError = '';
    try {
      await fullProgramLink({ ...program, project: { ...project, files: [{ fileName: 'App.kt', kind: 'functions', source: 'x'.repeat(1_000_000) }] } }, '/BlueK/', 'https://example.github.io/BlueK/');
    } catch (error) { largeError = error.message; }
    return {
      hosted: program.blueKUrl,
      offline: programForLink(project, 'App.kt', './', 'file:///tmp/BlueK.html', {}).blueKUrl,
      developer: program.blueKUrl,
      full: await fullProgramLink(program, '/BlueK/', 'https://example.github.io/BlueK/'),
      short: shortProgramLink('green-lamp-river', '/BlueK/', 'https://example.github.io/BlueK/'),
      largeError,
    };
  }, { moduleUrl: linksModule, project });
  assert.equal(links.hosted, 'https://example.github.io/BlueK/');
  assert.equal(links.offline, 'https://bluek.online/');
  assert.equal(links.developer, 'https://example.github.io/BlueK/');
  assert.match(links.full, /^https:\/\/example\.github\.io\/BlueK\/#run=p1\./);
  assert.equal(links.short, 'https://example.github.io/BlueK/run/green-lamp-river');
  assert.match(links.largeError, /too large for a full link/);
} finally {
  await browser.close();
}

assert.throws(() => embedProgram('<!doctype html>', program), /template is damaged/);
assert.throws(() => embedProgram(template + PROGRAM_PLACEHOLDER, program), /template is damaged/);
assert.throws(() => embedProgram(html, program), /template is damaged/, 'A filled file is not a template');

assert.throws(() => parseEmbeddedProgram(''), /no BlueK program/);
assert.throws(() => parseEmbeddedProgram('{'), /damaged/);
assert.throws(() => parseExportedProgram({ ...program, format: 'bluek-project' }), /Invalid BlueK program/);
assert.throws(() => parseExportedProgram({ ...program, version: 2 }), /Invalid BlueK program/);
assert.throws(() => createExportedProgram(project, 'Missing.kt', PUBLIC_BLUEK_URL), /main file/);
assert.throws(() => createExportedProgram(project, undefined, PUBLIC_BLUEK_URL), /main file/);
assert.throws(() => createExportedProgram(project, 'App.kt', 'javascript:alert(1)'), /invalid BlueK address/);
assert.throws(() => createExportedProgram(project, 'App.kt', 'not a url'), /invalid BlueK address/);
assert.throws(() => createExportedProgram({ ...project, files: [{ fileName: 'x.txt', source: '' }] }, 'x.txt', PUBLIC_BLUEK_URL), /Invalid Kotlin file/);

assert.equal(blueKUrlForExport('https://bluek.online', '/'), 'https://bluek.online/');
assert.equal(blueKUrlForExport('https://example.github.io', '/BlueK/'), 'https://example.github.io/BlueK/');
assert.equal(blueKUrlForExport('http://localhost:5173', '/'), PUBLIC_BLUEK_URL, 'Development server');
assert.equal(blueKUrlForExport('http://127.0.0.1:8765', '/'), PUBLIC_BLUEK_URL, 'Offline package');
assert.equal(blueKUrlForExport('http://[::1]:8765', '/'), PUBLIC_BLUEK_URL);

assert.equal(parseExportedProgram(program).allowDownload, undefined, 'Old HTML exports retain their actions');
const restricted = createExportedProgram(project, 'App.kt', PUBLIC_BLUEK_URL, { allowDownload: false, allowBlueK: false, showProjectName: false, autoRun: true, showControls: false, showSpeed: false });
assert.equal(parseEmbeddedProgram(programScriptText(restricted)).allowDownload, false);
assert.equal(parseEmbeddedProgram(programScriptText(restricted)).showControls, false);
assert.equal(parseEmbeddedProgram(programScriptText(restricted)).showProjectName, false);
assert.equal(parseExportedProgram(program).showProjectName, undefined, 'Older exports continue showing the project name');
for (const key of ['allowDownload', 'allowBlueK', 'showProjectName', 'autoRun', 'showControls', 'showSpeed'])
  assert.throws(() => parseExportedProgram({ ...program, [key]: 'false' }), /options/);
assert.throws(() => createExportedProgram({ ...project, library: { id: 'blueplay', version: 1 } }, 'App.kt', PUBLIC_BLUEK_URL,
  { autoRun: false, showControls: false }), /Run button/);

assert.equal(exportFileName('  Mein <Spiel>  ', '.html'), 'Mein -Spiel-.html');
assert.equal(exportFileName('', '.bluek.json'), 'bluek-project.bluek.json');
assert.equal(exportFileName(undefined, '.html'), 'bluek-project.html');

console.log('Program export smoke passed.');
