import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

vm.runInThisContext(await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8'));
const api = globalThis['bluek-kotlite-browser'];
async function load(source, library = null, fileName = 'Main.kt') {
  const session = api.bluekCreateKotliteSession();
  session.configureBluePlay(library === 'blueplay', 'argument-diagnostics');
  const result = await new Promise(resolve => {
    const started = JSON.parse(session.startLoadProject([fileName], [source], library, 1, () => {}, value => resolve(JSON.parse(value))));
    if (started.kind === 'error') resolve(started);
  });
  return { session, result };
}
const world = 'class Spielfeld : World(600, 400, 1) {\n    var schritte: Int = 0\n\n    override fun act() {\n        schritte++\n        showText(schritte, 100, 50)\n    }\n}';
const cases = [
  ['BluePlay implicit inherited member', world, 'schritte', 'Int', 'String', 'blueplay', 'Spielfeld.kt'],
  ['superclass constructor', 'class Spielfeld : World(600, "wrong", 1)', '"wrong"', 'String', 'Int', 'blueplay', 'Spielfeld.kt'],
  ['explicit member', 'fun main() { class Anzeige { fun zeige(text: String) {} }; Anzeige().zeige(17) }', '17', 'Int', 'String'],
  ['top-level function', 'fun zeige(text: String) {}\nfun main() { zeige(17) }', '17', 'Int', 'String'],
  ['named/default arguments', 'fun zeige(text: String, x: Int = 0) {}\nfun main() { zeige(x = 3, text = 17) }', '17', 'Int', 'String'],
  ['second argument', 'fun zeige(text: String, x: Int) {}\nfun main() { zeige("text", "wrong") }', '"wrong"', 'String', 'Int'],
  ['vararg', 'fun zeige(vararg text: String) {}\nfun main() { zeige("text", 17) }', '17', 'Int', 'String'],
  ['constructor', 'fun main() { class Anzeige(val text: String); Anzeige(17) }', '17', 'Int', 'String'],
  ['generic receiver member', 'fun main() { mutableListOf(1).add("wrong") }', '"wrong"', 'String', 'Int'],
  ['function value', 'val zeige: (String) -> Unit = {}\nfun main() { zeige(17) }', '17', 'Int', 'String'],
  ['member function value', 'fun main() { class Anzeige { val zeige: (String) -> Unit = {} }; Anzeige().zeige(17) }', '17', 'Int', 'String'],
];
for (const [label, source, marker, actual, expected, library = null, fileName = 'Main.kt'] of cases) {
  const { session, result } = await load(source, library, fileName);
  assert.equal(result.kind, 'error', label);
  assert.equal(result.phase, 'analysis', label);
  assert.equal(result.diagnostics.length, 1, label);
  const diagnostic = result.diagnostics[0];
  const offset = source.lastIndexOf(marker);
  assert.equal(diagnostic.fileName, fileName, label);
  assert.equal(diagnostic.line, source.slice(0, offset).split('\n').length, label);
  assert.equal(diagnostic.column, offset - source.lastIndexOf('\n', offset), label);
  assert.equal(diagnostic.severity, 'error', label);
  assert.equal(diagnostic.message.split(' at [')[0], `argument type mismatch: actual type is '${actual}', but '${expected}' was expected.`, label);
  assert.equal(session.takeOutput(), '', `${label}: analysis executes nothing`);
}
// Ambiguous wrong overloads and wrong arity must not invent a single expected type.
for (const [label, source] of [
  ['overloads', 'fun zeige(text: String) {}\nfun zeige(number: Int) {}\nfun main() { zeige(true) }'],
  ['arity', 'fun zeige(text: String) {}\nfun main() { zeige(1, 2) }'],
  ['missing required argument', 'fun zeige(text: String, x: Int) {}\nfun main() { zeige(17) }'],
  ['unknown named argument', 'fun zeige(text: String) {}\nfun main() { zeige(wrong = 17) }'],
]) {
  const { result } = await load(source);
  assert.equal(result.kind, 'error', label);
  assert.match(result.display, /No matching function or constructor `zeige`/, label);
  assert.doesNotMatch(result.display, /argument type mismatch/, label);
}
// A matching overload still wins, and the corrected student program executes normally.
const valid = await load('fun zeige(text: String) = "string"\nfun zeige(number: Int) = "int"\nfun main() { println(zeige(17)) }');
assert.notEqual(valid.result.kind, 'error', valid.result.display);
assert.notEqual(JSON.parse(valid.session.evaluate('<argument-diagnostics>', 'main()')).kind, 'error');
assert.equal(valid.session.takeOutput(), 'int\n');
const fixed = await load(world.replace('showText(schritte,', 'showText(schritte.toString(),'), 'blueplay', 'Spielfeld.kt');
assert.notEqual(fixed.result.kind, 'error', fixed.result.display);
assert.equal(JSON.parse(fixed.session.evaluate('<argument-diagnostics>', 'val feld = Spielfeld(); feld.act(); feld.schritte')).display, '1');
console.log('RT-112 argument diagnostics passed: eleven call forms, positions, rejection boundaries, overload selection and corrected BluePlay execution.');
