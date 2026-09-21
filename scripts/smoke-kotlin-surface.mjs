// The Kotlin standard library surface that BlueK promises to school code.
//
// Unlike `smoke-curriculum-kotlin.mjs`, which reproduces gaps that were already
// fixed, this file lists what student code is expected to reach - including
// what does NOT work yet. `supported` must all pass; `gaps` must all still
// fail. A gap that starts working is reported too, so the list stays honest
// when Kotlite is updated.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

vm.runInThisContext(await readFile(new URL('../frontend/public/kotlite/bluek-kotlite-browser.js', import.meta.url), 'utf8'));
const api = globalThis['bluek-kotlite-browser'];
const session = api.bluekCreateKotliteSession();
session.configureBluePlay(false, 'surface');
const loaded = await new Promise(resolve => {
  const started = JSON.parse(session.startLoadProject(['Main.kt'], ['fun main() {}'], null, 1, () => {}, value => resolve(JSON.parse(value))));
  if (started.kind === 'error') resolve(started);
});
assert.notEqual(loaded.kind, 'error', `project load: ${loaded.display}`);
const evaluate = source => JSON.parse(session.evaluate('<surface>', source));

// Expression -> expected `display`. Grouped as in docs/kotlin-surface.md.
const supported = [
  // Numbers: minOf/maxOf/coerce* and the Int/Char conversions (BlueKStdlibModule, group B).
  ['minOf(3, 1)', '1'],
  ['minOf(4, 2, 3)', '2'],
  ['minOf(9, 8, 7, 6)', '6'],
  ['maxOf(3, 1)', '3'],
  ['maxOf(1, 2, 3, 4)', '4'],
  ['minOf(2.5, 1.5)', '1.5'],
  ['maxOf(1.0, 2.0, 3.0)', '3.0'],
  ['(-5).coerceIn(0, 10)', '0'],
  ['15.coerceIn(0, 10)', '10'],
  ['5.coerceIn(0, 10)', '5'],
  ['5.coerceAtLeast(7)', '7'],
  ['5.coerceAtMost(3)', '3'],
  ['2.5.coerceIn(0.0, 1.0)', '1.0'],
  ['Int.MAX_VALUE', '2147483647'],
  ['Int.MIN_VALUE', '-2147483648'],
  ['97.toChar()', 'a'],
  ["'5'.digitToInt()", '5'],
  ["'a'.code", '97'],
  // Already provided by the Kotlite stdlib - listed so a regression is caught here too.
  ['abs(-5)', '5'],
  ['sqrt(9.0)', '3.0'],
  ['3.5.roundToInt()', '4'],
  ["'a'.isDigit()", 'false'],

  // List aggregates (group C).
  ['listOf(1, 2, 3).sum()', '6'],
  ['listOf<Int>().sum()', '0'],
  ['listOf(1.5, 2.5).sum()', '4.0'],
  ['listOf(1, 2, 3).average()', '2.0'],
  ['(1..3).sum()', '6'],
  ['listOf(1, 2, 3).indices', '[0, 1, 2]'],
  ['listOf(1, 2, 3).lastIndex', '2'],
  ['listOf(1, 2, 3).sumOf { it * 2 }', '12'],
  ['listOf("a", "bb").sumOf { it.length }', '3'],
  ['listOf(1, 2, 3).reduce { a, b -> a + b }', '6'],
  ['(1..4).reduce { a, b -> a + b }', '10'],
  ['listOf(listOf(1, 2), listOf(3)).flatten()', '[1, 2, 3]'],
  ['listOf(3, 1, 2).sorted()', '[1, 2, 3]'],
  ['listOf(1, 2, 3).maxOrNull()', '3'],

  // String as a character sequence (group A).
  ['"a,b,c".split(",")', '[a, b, c]'],
  ["\"a b\".split(' ')", '[a, b]'],
  ['"hallo welt".split(" ").size', '2'],
  ['"abc"[1]', 'b'],
  ['"abc".toList()', '[a, b, c]'],
  ['"abc".indices', '[0, 1, 2]'],
  ['var s = ""; for (c in "abc") s += c; s', 'abc'],
  ['var n = 0; for (c in "hallo") if (c == \'l\') n += 1; n', '2'],
  ['"abc".uppercase()', 'ABC'],
  ['"abc".first()', 'a'],
  // Provided by the stdlib already (which is why BlueK cannot redeclare it).
  ['"abc".lastIndex', '2'],

  // A whole school-style routine, to prove the pieces combine.
  ['fun quersumme(wort: String): Int { var s = 0; for (c in wort) if (c.isDigit()) s += c.digitToInt(); return s }; quersumme("a1b22")', '5'],
];

// Known gaps: documented in docs/kotlin-surface.md, deliberately not implemented.
const gaps = [
  'arrayOf(1, 2)',              // arrays are absent as a language feature
  'IntArray(3)',
  'Array(3) { 0 }',
  '"%.2f".format(3.14159)',     // needs a format-string implementation
  'String.format("%d", 5)',
  'listOf(1, 2).withIndex()',   // needs an IndexedValue class
  '"abc".map { it }',           // String is not an Iterable
  '"abc".toCharArray()',
  '"abc".chunked(2)',
  'kotlin.math.abs(-5)',        // fully qualified calls (import + abs(-5) works)
  'Math.abs(-1)',               // Java, correctly unavailable
  'Double.MAX_VALUE',
  "Char.MIN_VALUE",
];

// Messages for missing names: BlueK says which side the gap is on instead of
// passing Kotlite's generic wording through. Three cases, see KotlinSurfaceHints.
const messages = [
  // 1. documented gap -> named alternative
  ['arrayOf(1, 2)', /BlueK has no arrays\. Use listOf/],
  ['Array(3) { 0 }', /BlueK has no arrays/],
  ['Math.abs(-1)', /`Math` belongs to Java and is not available in BlueK/],
  ['kotlin.math.abs(-5)', /does not support fully qualified calls.*import kotlin\.math\.abs/],
  ['"abc".map { it }', /a String is not a full character sequence/],
  ['listOf(1, 2).withIndex()', /`withIndex\(\)` is not available in BlueK/],
  ['"%.2f".format(3.14159)', /cannot format numbers with a format string/],
  ['Double.MAX_VALUE', /provides `Int\.MAX_VALUE`/],
  // 2. close to a name BlueK has -> suggestion
  ['minOff(1, 2)', /`minOff` is not available in BlueK\. Did you mean `minOf`\?/],
  ['pritnln("a")', /Did you mean `println`\?/],
  ['"abc".splitt(",")', /`splitt` is not available for String in BlueK\. Did you mean `split`\?/],
  // 3. no idea -> name both possibilities, blame neither
  // (a name the session never declares - `quersumme` below is declared, and
  // would correctly be passed through as an argument-type error)
  ['bruttosumme(5)', /`bruttosumme` is unknown: neither declared in this project nor provided by BlueK/],
  ['listOf(1, 2).verdopple()', /`verdopple` is unknown for List<Int>: neither declared/],
  // Kotlite's own wording must not leak for any of these.
  ['zzz(1)', /^(?!.*No matching function)/],
  ['"abc".zzz()', /^(?!.*has no member)/],
];

// A name that exists but is called wrongly is NOT a gap: Kotlite words both the
// same way, and only its message names the argument types. It must pass through.
const passedThrough = [
  ['"a,b".split(1, 2, 3)', /No matching function `split`.*argument types \(Int, Int, Int\)/],
  ['fun zeige(text: String) {}; zeige(5)', /No matching function.*`zeige`.*argument types \(Int\)/],
];

const failures = [];
for (const [expression, expected] of supported) {
  const result = evaluate(expression);
  if (result.kind === 'error') failures.push(`${expression}\n    fehlt: ${result.display.split('\n')[0]}`);
  else if (result.display !== expected) failures.push(`${expression}\n    ${result.display} statt ${expected}`);
}
for (const [expression, pattern] of messages) {
  const result = evaluate(expression);
  if (result.kind !== 'error') failures.push(`${expression}\n    sollte eine Fehlermeldung ergeben`);
  else if (!pattern.test(result.display)) failures.push(`${expression}\n    Meldung passt nicht: ${result.display.split('\n')[0]}`);
}
for (const [expression, pattern] of passedThrough) {
  const result = evaluate(expression);
  if (result.kind !== 'error') failures.push(`${expression}\n    sollte eine Fehlermeldung ergeben`);
  else if (!pattern.test(result.display)) failures.push(`${expression}\n    hätte durchgereicht werden müssen: ${result.display.split('\n')[0]}`);
}
for (const expression of gaps) {
  if (evaluate(expression).kind !== 'error') {
    failures.push(`${expression}\n    ist keine Lücke mehr - Eintrag aus 'gaps' entfernen`);
  }
}

if (failures.length > 0) {
  console.error(`Kotlin surface smoke test failed (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`Kotlin surface smoke test passed (${supported.length} supported, ${gaps.length} known gaps, ${messages.length + passedThrough.length} messages).`);
