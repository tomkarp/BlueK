import assert from 'node:assert/strict';
import { rolldown } from 'rolldown';

// Test the helpers imported by the actual Svelte component, not a reimplementation.
const bundle = await rolldown({ input: 'frontend/src/uiParity.ts' });
const { output } = await bundle.generate({ format: 'esm' });
await bundle.close();
const ui = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'));

assert.equal(ui.appendTerminal(ui.appendTerminal('', 'X'), 'Y\n'), 'XY\n');
const transcript = ui.appendTerminal('A\n\u0001Test\u0002\n', 'B\nTest\n');
assert.deepEqual(ui.terminalParts(transcript), [
  { text: 'A\n', input: false }, { text: 'Test', input: true },
  { text: '\nB\nTest\n', input: false },
]);
assert.equal(ui.appendTerminal(transcript, '\fnew'), 'new');
assert.equal(ui.appendTerminal(transcript, 'first\fsecond\ffinal'), 'final');
assert.deepEqual(ui.terminalParts(''), []);
// ANSI escape sequences and control characters as terminals interpret them (GUI-97).
const ESC = '\u001B';
assert.deepEqual(ui.terminalParts(`│  ${ESC}[31m♥${ESC}[0m  │\n│  ${ESC}[30m♠${ESC}[0m  │`), [
  { text: '│  ', input: false }, { text: '♥', input: false, style: 'color:var(--ansi-1,#cd3131)' },
  { text: '  │\n│  ', input: false }, { text: '♠', input: false, style: 'color:var(--ansi-0,#000000)' }, { text: '  │', input: false },
]);
assert.deepEqual(ui.terminalParts(`${ESC}[1;4;93;44mA${ESC}[22;24mB${ESC}[39;49mC`), [
  { text: 'A', input: false, style: 'color:var(--ansi-11,#b5ba00);background-color:var(--ansi-4,#0451a5);font-weight:bold;text-decoration-line:underline' },
  { text: 'B', input: false, style: 'color:var(--ansi-11,#b5ba00);background-color:var(--ansi-4,#0451a5)' }, { text: 'C', input: false },
]);
assert.deepEqual(ui.terminalParts(`${ESC}[38;5;208mx${ESC}[38;2;10;20;30;48;5;240my${ESC}[mz`), [
  { text: 'x', input: false, style: 'color:#ff8700' },
  { text: 'y', input: false, style: 'color:#0a141e;background-color:#585858' }, { text: 'z', input: false },
]);
assert.deepEqual(ui.terminalParts(`${ESC}[7mi${ESC}[27m${ESC}[2mj${ESC}[3;9mk${ESC}[8ml`), [
  { text: 'i', input: false, style: 'color:var(--terminal-bg,#fff);background-color:var(--terminal-fg,#222)' },
  { text: 'j', input: false, style: 'opacity:.6' }, { text: 'k', input: false, style: 'opacity:.6;font-style:italic;text-decoration-line:line-through' },
  { text: 'l', input: false, style: 'color:transparent;opacity:.6;font-style:italic;text-decoration-line:line-through' },
]);
const plainText = (value) => ui.terminalParts(value).map(part => part.text).join('');
assert.equal(plainText('Laden 10%\rLaden 100%\nfertig'), 'Laden 100%\nfertig'); // \r overwrites the line
assert.equal(plainText('Laden 100%\rOK'), 'OKden 100%');
assert.equal(plainText(`Laden 100%\r${ESC}[KOK`), 'OK');
assert.equal(plainText('abc\b\bX\ty\u0007'), 'aXc     y'); // \t moves to the next tab stop
assert.equal(plainText('Name\tAlter\nBob\t42'), 'Name    Alter\nBob     42');
assert.equal(plainText(`alt\nalt${ESC}[H${ESC}[2Jneu`), 'neu'); // clear screen
assert.equal(plainText(`alt${ESC}[2J${ESC}[Hneu`), 'neu');
assert.equal(plainText(`${ESC}cneu`), 'neu');
assert.equal(plainText(`1\n2\n3${ESC}[2A${ESC}[2Gx${ESC}[3;3Hy`), '1x\n2\n3 y');
assert.equal(plainText(`ab${ESC}[s\ncd${ESC}[uX`), 'abX\ncd');
assert.equal(plainText(`a${ESC}[?25lb${ESC}]0;Titel\u0007c${ESC}[`), 'abc'); // swallowed; an unfinished sequence follows later
assert.equal(plainText(`zeile\n${ESC}[1A${ESC}[2Kneu`), 'neu\n');
assert.deepEqual(ui.terminalParts(`${ESC}[32m>\u0001ein\u0002\n`), [
  { text: '>', input: false, style: 'color:var(--ansi-2,#00bc00)' }, { text: 'ein', input: true, style: 'color:var(--ansi-2,#00bc00)' },
  { text: '\n', input: false, style: 'color:var(--ansi-2,#00bc00)' },
]);
// Larger and smaller text with kitty's text sizing protocol OSC 66 (GUI-98).
const sizedBox = (width, height, vertical = 'flex-start', horizontal = 'flex-start') => [
  'display:inline-flex', 'vertical-align:top', `width:${width}ch`, `height:${height}lh`,
  ...(height > 1 ? [`margin-bottom:-${height - 1}lh`] : []), `align-items:${vertical}`, `justify-content:${horizontal}`,
].join(';');
const sizedText = (scale, style) => [style, `font-size:${scale}em`, `line-height:${scale}lh`, 'flex:none', 'white-space:pre'].filter(Boolean).join(';');
assert.deepEqual(ui.terminalParts(`Karte: ${ESC}[31m${ESC}]66;s=7;\u{1F0B1}\u0007${ESC}[0m daneben${'\n'.repeat(7)}unten`), [
  { text: 'Karte: ', input: false },
  { text: '\u{1F0B1}', input: false, box: sizedBox(7, 7), style: sizedText(7, 'color:var(--ansi-1,#cd3131)') },
  { text: ' daneben\n\n\n\n\n\n\nunten', input: false },
]);
// The text overlays the lines below; they exist even without further output. ESC \ also ends it.
assert.deepEqual(ui.terminalParts(`${ESC}]66;s=2;Titel${ESC}\\`), [
  { text: 'Titel', input: false, box: sizedBox(10, 2), style: sizedText(2) }, { text: '\n', input: false },
]);
assert.deepEqual(ui.terminalParts(`${ESC}]66;n=1:d=2:w=1;Ha\u0007|${ESC}]66;s=3:w=1:v=2:h=1;Z\u0007`), [
  { text: 'Ha', input: false, box: sizedBox(1, 1), style: sizedText(0.5) }, { text: '|', input: false },
  { text: 'Z', input: false, box: sizedBox(3, 3, 'center', 'flex-end'), style: sizedText(3) }, { text: '\n\n', input: false },
]);
assert.deepEqual(ui.terminalParts(`${ESC}]66;s=2:n=1:d=2;ab\u0007`)[0].style, sizedText(1));
// Invalid values fall back to the defaults; other OSC sequences stay swallowed.
assert.deepEqual(ui.terminalParts(`${ESC}]66;s=9:v=7:x=1;A\u0007`), [{ text: 'A', input: false, box: sizedBox(1, 1), style: sizedText(1) }]);
assert.deepEqual(ui.terminalParts(`${ESC}]66;s=2;\u0007ok${ESC}]0;Titel\u0007`), [{ text: 'ok', input: false }]);
// Writing into or erasing a cell of sized text removes all of it, as in kitty.
assert.equal(plainText(`${ESC}]66;s=2;AB\u0007\rX`), 'X   \n');
assert.equal(plainText(`ab${ESC}]66;s=2;CD\u0007${ESC}[3D${ESC}[K`), 'ab \n');
assert.equal(plainText(`ab${ESC}]66;s=2;CD\u0007${ESC}[2K`), '\n');
assert.equal(plainText(`${ESC}]66;s=2;AB\u0007${ESC}[H${ESC}[2Jneu`), 'neu');
assert.equal(ui.codepadResult({ kind: 'unit' }), undefined);
assert.equal(ui.codepadResult({ kind: 'error' }), undefined);
assert.equal(ui.codepadResult({ kind: 'scalar', type: { displayName: 'String' }, display: 'hello' }), '"hello" : String');
assert.equal(ui.codepadResult({ kind: 'scalar', type: { displayName: 'Int' }, display: '3' }), '3 : Int');
assert.equal(ui.defaultObjectName('Hund'), 'hund1');
assert.equal(ui.defaultObjectName('Hund', ['hund1', 'hund3']), 'hund2');
assert.equal(ui.defaultObjectName('Box<String>', ['box1']), 'box2');
assert.equal(ui.sourceDeclarationName('class Hund { }'), 'Hund');
assert.equal(ui.sourceDeclarationName('interface Tier { }'), 'Tier');
assert.equal(ui.sourceDeclarationName('// empty'), null);

// GUI-83: every Image operation the BluePlay library emits is drawn, for actor
// images (including nested ones) as well as backgrounds, which are Images too.
const svgOf = (url) => decodeURIComponent(url.split(',')[1]);
assert.match(svgOf(ui.drawnImageDataUrl(['fill|rgb(200,0,0)'], 20, 20)),
  /<rect x="0" y="0" width="20" height="20" fill="rgb\(200,0,0\)"\/>/);
assert.match(svgOf(ui.drawnImageDataUrl(['fill|rgb(1,2,3)'], 40, 30)),
  /<rect x="0" y="0" width="40" height="30" fill="rgb\(1,2,3\)"\/>/);
const nested = '__bluek:{\\"operations\\":[\\"fill\\prgb(0,0,200)\\"],\\"width\\":6,\\"height\\":6}';
const framed = svgOf(ui.drawnImageDataUrl(['fill|rgb(0,160,0)', `drawImage|${nested}|7|7|6|6`], 20, 20));
assert.match(framed, /^<svg[^>]*><rect x="0" y="0" width="20" height="20" fill="rgb\(0,160,0\)"\/><image href="data:image\/svg\+xml/);
assert.match(decodeURIComponent(framed.match(/href="data:image\/svg\+xml;charset=utf-8,([^"]+)"/)[1]),
  /<rect x="0" y="0" width="6" height="6" fill="rgb\(0,0,200\)"\/>/);
const shapes = svgOf(ui.drawnImageDataUrl(['fillRect|1|2|3|4|red', 'drawOval|0|0|10|6|blue', 'drawString|a\\pb|1|9|green'], 20, 20));
assert.match(shapes, /<rect x="1" y="2" width="3" height="4" fill="red"\/>/);
assert.match(shapes, /<ellipse cx="5" cy="3" rx="5" ry="3" fill="none" stroke="blue"\/>/);
assert.match(shapes, /<text x="1" y="9" fill="green">a\|b<\/text>/);
assert.equal(ui.drawnImageDataUrl(null, 20, 20), undefined);
assert.equal(ui.drawnImageDataUrl(['unknown|1'], 20, 20), undefined);

// Output chunks combined before they reach the terminal give the same text as
// appending each of them, including clears (form feed) and the size limit.
for (const chunks of [['a', 'b\n'], ['old', '\fnew', 'er'], ['x\fy', 'z'], ['k'.repeat(700_000), 'm'.repeat(700_000), 'tail'], ['\f' + 'n'.repeat(1_200_000), 'end'], ['p', '\u0001in\u0002\n', 'q']]) {
  const sequential = chunks.reduce((terminal, chunk) => ui.appendTerminal(terminal, chunk), 'before\n');
  const combined = ui.appendTerminal('before\n', chunks.reduce(ui.combineTerminalOutput, ''));
  assert.equal(combined, sequential, `combined output differs for ${JSON.stringify(chunks.map(chunk => chunk.slice(0, 8)))}`);
}

const params = [{ name: 'a', hasDefault: true }, { name: 'b', hasDefault: false }];
assert.equal(ui.missingRequired(params, ['', '2']), false);
assert.equal(ui.missingRequired(params, ['', '']), true);
assert.deepEqual(ui.kotlinCallArguments(params, ['', '2']), ['b = 2']);
assert.deepEqual(ui.kotlinCallArguments(params, ['1', '2']), ['1', '2']);
assert.equal(ui.missingTypeArgument(['Int', '']), true);
assert.equal(ui.codepadIsDisabled('uncompiled'), false);
assert.equal(ui.codepadIsDisabled('ready'), false);
assert.equal(ui.codepadIsDisabled('compiling'), true);
assert.equal(ui.codepadIsDisabled('running'), true);
assert.equal(ui.codepadIsDisabled('waitingForInput'), true);
assert.equal(ui.codepadIsDisabled('ready', true), true);
const child = '// comment\nclass Hund(val name: String) {\n}\n';
const inherited = ui.addSuperclass(child, 'Tier');
assert.equal(inherited, '// comment\nclass Hund(val name: String) : Tier() {\n}\n');
assert.equal(ui.sourceSuperclass(inherited), 'Tier');
assert.equal(ui.addSuperclass(inherited, 'Tier'), inherited);
assert.equal(ui.sourceSuperclass('class Solo {}'), null);
const rect = { left: 10, top: 20, width: 100, height: 60 };
assert.deepEqual(ui.cardBorderPoint(rect, ui.cardCenter(rect), { x: 260, y: 50 }), { x: 110, y: 50 });
const generic = { name: 'echo', parameters: [{ name: 'value', type: { classifier: 'T', displayName: 'T' } }], returnType: { classifier: 'T', displayName: 'T' } };
const specialized = ui.specializeCallable(generic, { className: 'Box<List<String>>' }, [{ name: 'Box', typeParameters: ['T'] }]);
assert.equal(specialized.parameters[0].type.displayName, 'List<String>');
assert.equal(specialized.returnType.displayName, 'List<String>');
assert.equal(generic.parameters[0].type.displayName, 'T');

globalThis.window = globalThis;
const project = { format: 'bluek-project', version: 1, files: [{ fileName: 'Hund.kt', source: child }] };
const link = await ui.encodeBlueKLink(project);
assert.match(link, /^(d1|p1)\./);
assert.deepEqual(await ui.decodeBlueKLink(link), project);
const plain = 'p1.' + Buffer.from(JSON.stringify(project)).toString('base64url');
assert.deepEqual(await ui.decodeBlueKLink(plain), project);
const decompressor = globalThis.DecompressionStream;
delete globalThis.DecompressionStream;
try { assert.deepEqual(await ui.decodeBlueKLink(link), project); }
finally { globalThis.DecompressionStream = decompressor; }
await assert.rejects(ui.decodeBlueKLink('unknown.version'));
console.log('Svelte UI behavior tests passed: terminal, codepad, arguments, inheritance, generics, project links.');
