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
  ['val ok1: String? = "ab"; ok1?.length', '2'],
  ['val ok2: String? = "ab"; ok2!!.length', '2'],
  ['val ok3: String? = "ab"; if (ok3 != null) ok3.length else 0', '2'],
  // toString/equals/hashCode on nullable receivers (BlueKStdlibModule, Any?)
  ['val nn1: Int? = 5; nn1.toString()', '5'],
  ['val nn2: Int? = null; nn2.toString()', 'null'],
  ['val nn3: Int? = 5; nn3.equals(5)', 'true'],
  ['val nn4: Int? = null; nn4.equals(null)', 'true'],
  ['val nn5: Int? = null; nn5.equals(1)', 'false'],
  ['val nn6: Int? = 5; nn6.hashCode()', '5'],
  ['val nn7: Int? = null; nn7.hashCode()', '0'],
  ['class NnQ(val n: Int) {\n  override fun toString(): String = "Q$n"\n  override fun equals(other: Any?): Boolean = other is NnQ && (other as NnQ).n == n\n  override fun hashCode(): Int = n + 100\n}\nval nn8: NnQ? = NnQ(1)\nnn8.toString() + nn8.equals(NnQ(1)) + nn8.hashCode()', 'Q1true101'],
  // `?.` calls them on the non-null receiver: the member of T wins over the Any?
  // extensions above instead of being ambiguous with them (RT-44, World.kt in examples/blueplay).
  ['val sc1: Int? = 5; sc1?.toString()', '5'],
  ['val sc2: Int? = null; sc2?.toString()', 'null'],
  ['val sc3: Int? = null; sc3?.toString() ?: "255"', '255'],
  ['val sc4: Int? = 5; sc4?.equals(5)', 'true'],
  ['val sc5: Int? = 5; sc5?.hashCode()', '5'],
  ['val sc6: String? = "a"; sc6?.toString()', 'a'],
  ['val sc7: String? = "a"; sc7?.equals("a")', 'true'],
  ['val sc8: String? = "a"; sc8?.hashCode()', '97'],
  ['class ScQ(val n: Int) {\n  override fun toString(): String = "Q$n"\n  override fun equals(other: Any?): Boolean = other is ScQ && (other as ScQ).n == n\n  override fun hashCode(): Int = n + 100\n}\nval sc9: ScQ? = ScQ(1)\n"${sc9?.toString()}${sc9?.equals(ScQ(1))}${sc9?.hashCode()}"', 'Q1true101'],
  ['class ScP(val n: Int)\nval sc10: ScP? = ScP(1)\nsc10?.toString()?.startsWith("ScP")', 'true'],
  ['class ScR(val n: Int)\nval sc11: ScR? = null\n"${sc11?.toString()}${sc11?.equals(null)}${sc11?.hashCode()}"', 'nullnullnull'],
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

  // Maps (RT-58): `entries` is a snapshot of the entries; they print like Kotlin's.
  ['mapOf("a" to 1, "b" to 2).entries', '[a=1, b=2]'],
  ['var me = ""; for (e in mapOf("a" to 1, "b" to 2).entries) me += "${e.key}:${e.value} "; me', 'a:1 b:2 '],
  ['mapOf("a" to 3, "b" to 1).entries.sortedBy { it.value }.map { it.key }', '[b, a]'],
  ['mapOf("a" to 3, "b" to 1).entries.maxByOrNull { it.value }?.key', 'a'],
  ['val mm = mutableMapOf("a" to 1); val ment = mm.entries; mm["b"] = 2; "${ment.size} $ment"', '1 [a=1]'],

  // RT-59: limits, maps, strings, Char ranges, chunked/windowed.
  ['Double.MAX_VALUE > 10.0.pow(300)', 'true'],
  ['Double.MIN_VALUE > 0.0 && Double.MIN_VALUE < 10.0.pow(-300)', 'true'],
  ['Double.POSITIVE_INFINITY', 'Infinity'],
  ['Double.NaN.isNaN()', 'true'],
  ['Char.MIN_VALUE.code', '0'],
  ['Char.MAX_VALUE.code', '65535'],
  ['mapOf("a" to 1).containsKey("a")', 'true'],
  ['mapOf("a" to 1).containsKey("b")', 'false'],
  ['mapOf("a" to 1).getOrDefault("x", 0)', '0'],
  ['mapOf("a" to 1).getOrDefault("a", 0)', '1'],
  ['"a\nb\r\nc".lines()', '[a, b, c]'],
  ['"ab".zip("cde")', '[(a, c), (b, d)]'],
  ['"banane".count { it == \'a\' }', '2'],
  ["('a'..'c').toList()", '[a, b, c]'],
  ["var abc = \"\"; for (c in 'a'..'e') abc += c; abc", 'abcde'],
  ["('a'..'z').count()", '26'],
  ['listOf(1, 2, 3, 4, 5).chunked(2)', '[[1, 2], [3, 4], [5]]'],
  ['(1..5).chunked(2)', '[[1, 2], [3, 4], [5]]'],
  ['listOf(1, 2, 3, 4).windowed(2)', '[[1, 2], [2, 3], [3, 4]]'],
  ['listOf(1, 2, 3, 4, 5).windowed(3, 2, true)', '[[1, 2, 3], [3, 4, 5], [5]]'],

  // RT-62: Triple, StringBuilder/buildString, kotlin.random.Random.
  ['Triple(1, "a", 2.5)', '(1, a, 2.5)'],
  ['val tr = Triple("x", 2, true); "${tr.first} ${tr.second} ${tr.third}"', 'x 2 true'],
  ['Triple(1, 2, 3) == Triple(1, 2, 3)', 'true'],
  ['buildString { append("a"); append(1); append(2.5) }', 'a12.5'],
  ['buildString { for (i in 1..3) append(i) }', '123'],
  ['buildString { append("a"); appendLine(); append("b") }.lines()', '[a, b]'],
  ['val sb = StringBuilder(); sb.append("Hallo").append(" ").append("Welt"); "$sb ${sb.length}"', 'Hallo Welt 10'],
  ['StringBuilder("abc").reverse().toString()', 'cba'],
  ['val sb2 = StringBuilder("ab"); sb2.insert(1, "X"); "$sb2 ${sb2[0]} ${sb2.isEmpty()}"', 'aXb a false'],
  ['StringBuilder().apply { append("x"); append("y") }.toString()', 'xy'],
  ['Random.nextInt(5, 6)', '5'],
  ['Random.nextInt(1)', '0'],
  ['List(20) { Random.nextInt(1, 7) }.all { it in 1..6 }', 'true'],
  ['Random.nextDouble() < 1.0 && Random.nextDouble(2.0, 3.0) >= 2.0', 'true'],
  ['Random.nextBoolean() || true', 'true'],

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
  'mapOf(1 to 2).forEach { k, v -> }', // the JVM's two-parameter form; `forEach { it.key }` works
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

// `.` on a nullable receiver: the member exists, only the call is unsafe. Kotlin
// says so in its own words; "unknown for ..." would send the student hunting for
// a spelling mistake. A genuinely unknown member on a nullable receiver stays unknown.
const nullableReceiver = [
  ['val nl1: MutableList<Int>? = null; nl1.add(1)', /^Only safe \(\?\.\) or non-null asserted \(!!\.\) calls are allowed on a nullable receiver of type 'MutableList<Int>\?'\./],
  // A class property, as in a student's Hund class: the receiver is `alle`, not a local.
  ['class NlHund {\n  var alle: MutableList<Int>? = mutableListOf()\n  fun neu(x: Int) {\n    alle.add(x)\n  }\n}', /^Only safe \(\?\.\) or non-null asserted \(!!\.\) calls are allowed on a nullable receiver of type 'MutableList<Int>\?'\./],
  ['class NlHund2 {\n  var name: String? = null\n  fun laenge(): Int = name.length\n}', /nullable receiver of type 'String\?'/],
  ['val nl2: String? = null; nl2.length', /nullable receiver of type 'String\?'/],
  ['class NlBox(var n: Int); val nl3: NlBox? = null; nl3.n = 3', /nullable receiver of type 'NlBox\?'/],
  ['val nl4: String? = null; nl4.zzz()', /`zzz` is unknown for String/],
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
for (const [expression, pattern] of nullableReceiver) {
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
console.log(`Kotlin surface smoke test passed (${supported.length} supported, ${gaps.length} known gaps, ${messages.length + nullableReceiver.length + passedThrough.length} messages).`);
