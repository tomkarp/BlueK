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
  // Bit operations (RT-87); infix calls bind like Kotlin: after `+`, before `==`.
  ['5 and 3', '1'], ['5 or 3', '7'], ['5 xor 1', '4'], ['1 shl 3', '8'], ['-16 shr 2', '-4'],
  ['-16 ushr 28', '15'], ['5.inv()', '-6'], ['0xFF and 0x0F', '15'], ['5.and(3)', '1'],
  ['5L and 3L', '1'], ['1L shl 40', '1099511627776'], ['(1L shl 40).inv()', '-1099511627777'],
  ['1 + 2 shl 1', '6'], ['6 and 3 or 8', '10'], ['val bits = 5; bits and 1 == 1', 'true'],
  ['.5 + 1', '1.5'], ['.25e2', '25.0'], ['(1..3).toList()', '[1, 2, 3]'],
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
  // RT-93: empty collections, typed by their target.
  ['val leer: List<String> = emptyList(); leer.size', '0'],
  ['emptyList<Int>().isEmpty()', 'true'],
  ['emptySet<String>() + "x"', '[x]'],
  ['val m = mapOf("a" to listOf(1)); m["b"] ?: emptyList()', '[]'],
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

  // RT-65: componentN and withIndex for destructuring.
  ['Pair(1, 2).component2()', '2'],
  ['Triple(1, 2, 3).component3()', '3'],
  ['listOf(4, 5, 6).component3()', '6'],
  ['mapOf("a" to 1).entries.first().component1()', 'a'],
  ['listOf("a", "b").withIndex()', '[IndexedValue(index=0, value=a), IndexedValue(index=1, value=b)]'],
  ['listOf("a", "b").withIndex().map { it.index * 10 + it.value.length }', '[1, 11]'],

  // RT-73: error() throws IllegalStateException and has the type Nothing.
  ['try { error("kaputt") } catch (e: IllegalStateException) { e.message }', 'kaputt'],
  ['try { error(42) } catch (e: Exception) { e.message }', '42'],
  ['val e1: String? = null; try { e1 ?: error("leer") } catch (e: IllegalStateException) { "gefangen: " + e.message }', 'gefangen: leer'],
  ['val e2: Int = if (1 > 0) 7 else error("nie"); e2 + 1', '8'],

  // RT-66: format strings like java.util.Formatter, always with `.` as decimal point.
  ['"%.2f".format(3.14159)', '3.14'],
  ['"%.1f".format(0.15)', '0.2'],
  ['"%.2f".format(9.995)', '10.00'],
  ['"%,.2f".format(1234567.891)', '1,234,567.89'],
  ['"%8.2f|%-8.2f|".format(3.5, 3.5)', '    3.50|3.50    |'],
  ['"%+d %05d %,d".format(5, 42, 1234567)', '+5 00042 1,234,567'],
  ['"%s und %s".format("a", 1)', 'a und 1'],
  ['"%10s|%-6s|%.3s".format("x", "y", "Hallo")', '         x|y     |Hal'],
  ['"%x %X %o %c %b".format(255, 255, 8, \'A\', true)', 'ff FF 10 A true'],
  ['"100%%".format()', '100%'],
  ['String.format("%d Euro", 5)', '5 Euro'],
  ['String.format("%.2f", 1.0 / 3)', '0.33'],

  // RT-94: String as a character sequence, ifBlank/ifEmpty, Char overloads, numbers.
  ['"  ".ifBlank { "leer" }', 'leer'],
  ['"".ifEmpty { "x" }', 'x'],
  ['"abc".ifEmpty { "x" }', 'abc'],
  ['"hallo".replaceFirstChar { it.uppercase() }', 'Hallo'],
  ['"hallo".replaceFirstChar { it.uppercaseChar() }', 'Hallo'],
  ["\"Hallo\".indexOf('l')", '2'],
  ["\"Hallo\".lastIndexOf('l')", '3'],
  ['"Hallo".map { it.uppercaseChar() }', '[H, A, L, L, O]'],
  ['"abc".mapIndexed { i, c -> "$i$c" }', '[0a, 1b, 2c]'],
  ['"a1b2".filterIndexed { i, c -> i % 2 == 0 }', 'ab'],
  ["\"Hallo\".find { it == 'l' }", 'l'],
  ["\"Hallo\".findLast { it < 'm' }", 'l'],
  ["\"Hallo\".single { it == 'H' }", 'H'],
  ['"Hallo".sumOf { it.code }', '496'],
  ['"aab".groupBy { it }.mapValues { it.value.size }', '{a=2, b=1}'],
  ['"ab".associateWith { it.code }', '{a=97, b=98}'],
  ['"Hallo".toSet()', '[H, a, l, o]'],
  ["val zl = \"ab\".toMutableList(); zl.add('c'); zl", '[a, b, c]'],
  ['"Hallo".chunked(2)', '[Ha, ll, o]'],
  ['"Hallo".windowed(4)', '[Hall, allo]'],
  ['"Hallo".maxOrNull()', 'o'],
  ['"Hallo".minOrNull()', 'H'],
  ['"Hallo".elementAt(1)', 'a'],
  ['"ab".withIndex().map { "${it.index}${it.value}" }', '[0a, 1b]'],
  ['"  a\n  b".trimIndent()', 'a\nb'],
  ['"12".toLong() + 1', '13'],
  ['"x".toLongOrNull()', 'null'],
  ["'7'.digitToIntOrNull()", '7'],
  ["'x'.digitToIntOrNull()", 'null'],
  ['(-7).mod(3)', '2'],
  ['(-7).rem(3)', '-1'],
  ['10.toString(2)', '1010'],
  ['Long.MAX_VALUE', '9223372036854775807'],
  ['3.toFloat()', '3.0'],
  // RT-95: comparators, more list/map functions, Java-style constructors.
  ['val cmp1: Comparator<String> = compareBy { it.length }; listOf("ccc", "a").sortedWith(cmp1)', '[a, ccc]'],
  ['listOf("ccc", "a").sortedWith(compareBy<String> { it.length })', '[a, ccc]'],
  ['listOf(3, 1, 2).sortedWith(reverseOrder<Int>())', '[3, 2, 1]'],
  ['listOf(3, 1).sortedWith(Comparator<Int> { a, b -> a - b })', '[1, 3]'],
  ['listOf(3, 1).sortedWith { a, b -> a - b }', '[1, 3]'],
  ['data class Cmp2(val n: String, val a: Int); listOf(Cmp2("b", 2), Cmp2("a", 2), Cmp2("c", 1)).sortedWith(compareBy<Cmp2>({ it.a }, { it.n })).map { it.n }', '[c, a, b]'],
  ['data class Cmp3(val n: String, val a: Int); listOf(Cmp3("b", 2), Cmp3("c", 1)).sortedWith(compareBy<Cmp3> { it.a }.thenByDescending { it.n }).map { it.n }', '[c, b]'],
  ['data class Cmp4(val n: String, val a: Int); listOf(Cmp4("b", 2), Cmp4("c", 1)).sortedWith(compareByDescending<Cmp4> { it.a }).map { it.n }', '[b, c]'],
  ['val cmp5 = mutableListOf("bb", "a"); cmp5.sortWith(compareBy<String> { it.length }); cmp5', '[a, bb]'],
  ['listOf("a", "bbb").maxWith(compareBy<String> { it.length })', 'bbb'],
  ['compareBy<String> { it.length }.reversed().compare("aa", "b")', '-1'],
  ['listOf(1, 2, 3).sumOf { it * 2 }', '12'],
  ['listOf(1.5, 2.0).sumOf { it }', '3.5'],
  ['listOf(1, 2).associateBy { "k$it" }', '{k1=1, k2=2}'],
  ['listOf("a", "bb").associateWith { it.length }', '{a=1, bb=2}'],
  ['val mp1 = mutableMapOf("a" to 1); mp1.putAll(mapOf("c" to 3)); mp1', '{a=1, c=3}'],
  ['mapOf("b" to 1, "a" to 2).toSortedMap()', '{a=2, b=1}'],
  ['val mp2: Map<String, Int> = emptyMap(); mp2.isEmpty()', 'true'],
  ['val mp3 = HashMap<String, Int>(); mp3["x"] = 1; mp3', '{x=1}'],
  ['hashMapOf("a" to 1).size', '1'],
  ['val al1 = ArrayList<Int>(); al1.add(1); al1', '[1]'],
  ['arrayListOf(1, 2).size', '2'],
  ['hashSetOf(1, 1).size', '1'],
  ['listOf(1, 2, 3).slice(0..1)', '[1, 2]'],
  ['listOf(1, 2, 3).zipWithNext()', '[(1, 2), (2, 3)]'],
  ['listOf<Int>().ifEmpty { listOf(0) }', '[0]'],
  ['val ml1 = mutableListOf(1, 2); ml1.add(0, 9); ml1', '[9, 1, 2]'],
  ['val ml2 = mutableListOf(1, 2, 3); ml2.removeIf { it > 1 }; ml2', '[1]'],
  ['val ml3 = mutableListOf(1, 2, 3); ml3.reverse(); ml3', '[3, 2, 1]'],
  ['val ml4 = mutableListOf(1, 2); ml4.addFirst(0); ml4.addLast(3); ml4', '[0, 1, 2, 3]'],
  ['measureTimeMillis { } >= 0', 'true'],
  // RT-100: type arguments from the enclosing call and from a lambda's expected result.
  ['listOf("bb", "a").sortedWith(compareBy { it.length })', '[a, bb]'],
  ['data class Inf1(val n: String, val a: Int); listOf(Inf1("b", 2), Inf1("a", 2), Inf1("c", 1)).sortedWith(compareBy({ it.a }, { it.n })).map { it.n }', '[c, a, b]'],
  ['data class Inf2(val n: String, val a: Int); listOf(Inf2("b", 2), Inf2("c", 1)).sortedWith(compareBy { it.a }.thenBy { it.n }).map { it.n }', '[c, b]'],
  ['data class Inf3(val n: String, val a: Int); listOf(Inf3("b", 2), Inf3("c", 1)).sortedWith(compareByDescending { it.a }).map { it.n }', '[b, c]'],
  ['val inf4 = mutableListOf("bb", "a"); inf4.sortWith(compareBy { it.length }); inf4', '[a, bb]'],
  ['listOf("a", "bbb").maxWith(compareBy { it.length })', 'bbb'],
  ['listOf(3, 1, 2).sortedWith(reverseOrder())', '[3, 2, 1]'],
  ['val inf5 = mutableMapOf<String, MutableList<Int>>(); for (w in listOf(1, 2, 11)) inf5.getOrPut(if (w > 9) "zwei" else "eins") { mutableListOf() }.add(w); inf5', '{eins=[1, 2], zwei=[11]}'],
  ['val inf6 = mutableMapOf<Char, MutableSet<String>>(); inf6.getOrPut(\'a\') { mutableSetOf() }.add("x"); inf6', '{a=[x]}'],
  ['fun inf7(l: MutableList<String>): Int { l.add("a"); return l.size }; inf7(mutableListOf())', '1'],
  ['fun inf8(m: Map<String, Int>): Int = m.size; inf8(mapOf())', '0'],
  ['val inf9: Pair<List<Int>, Int> = Pair(emptyList(), 1); inf9.first.size', '0'],
  ['fun inf10(): List<Int> = listOf(1).ifEmpty { emptyList() }; inf10()', '[1]'],
  // RT-96: arrays as fixed-size lists with `set`, in-place sorting and `content…`.
  ['arrayOf(1, 2).size', '2'],
  ['intArrayOf(1, 2).sum()', '3'],
  ['Array(3) { it * 2 }.toList()', '[0, 2, 4]'],
  ['IntArray(3).toList()', '[0, 0, 0]'],
  ['IntArray(3) { it + 1 }.joinToString()', '1, 2, 3'],
  ['val ar1 = booleanArrayOf(false, false); ar1[1] = true; ar1.contentToString()', '[false, true]'],
  ['val ar2 = arrayOf("x", "y"); ar2[1] = "z"; ar2.joinToString("")', 'xz'],
  ['val ar3 = intArrayOf(3, 1, 2); ar3.sort(); ar3.contentToString()', '[1, 2, 3]'],
  ['val ar4 = intArrayOf(3, 1, 2); ar4.sortDescending(); ar4.toList()', '[3, 2, 1]'],
  ['data class Ar5(val n: Int); val ar5 = arrayOf(Ar5(2), Ar5(1)); ar5.sortBy { it.n }; ar5.map { it.n }', '[1, 2]'],
  ['var ar6 = 0; for (x in intArrayOf(1, 2, 3)) ar6 += x; ar6', '6'],
  ['val ar7 = intArrayOf(5, 6); var ar7s = ""; for (i in ar7.indices) ar7s += i; ar7s + ar7.lastIndex', '011'],
  ['2 in intArrayOf(1, 2)', 'true'],
  ['val ar8 = Array(2) { IntArray(3) }; ar8[1][2] = 7; ar8[1].contentToString()', '[0, 0, 7]'],
  ['val ar9 = intArrayOf(1, 2); ar9 == intArrayOf(1, 2)', 'false'],
  ['val ar10 = intArrayOf(1, 2); ar10.contentEquals(intArrayOf(1, 2))', 'true'],
  ['val ar11 = intArrayOf(1, 2); val ar11c = ar11.copyOf(); ar11c[0] = 9; ar11[0]', '1'],
  ['val ar12 = IntArray(2); ar12.fill(4); ar12.toList()', '[4, 4]'],
  ['var ar13 = intArrayOf(1); ar13 = ar13 + 2; ar13.contentToString()', '[1, 2]'],
  ['listOf(1, 2).toIntArray().sum()', '3'],
  ['listOf("a").toTypedArray().size', '1'],
  ['val ar14 = "cab".toCharArray(); ar14.sort(); ar14.concatToString() + ar14.joinToString("")', 'abcabc'],
  ['DoubleArray(2).toList()', '[0.0, 0.0]'],
  ['val ar15 = arrayOfNulls<String>(2); ar15[0] = "x"; ar15.toList()', '[x, null]'],
  ['fun ar16(a: IntArray): Int = a.sum(); ar16(intArrayOf(2, 3))', '5'],
  ['class Ar17 { val zellen = Array(2) { BooleanArray(2) }; fun setze(x: Int, y: Int) { zellen[y][x] = true } }; val ar17 = Ar17(); ar17.setze(1, 0); ar17.zellen[0].contentToString()', '[false, true]'],
  // A whole school-style routine, to prove the pieces combine.
  ['fun quersumme(wort: String): Int { var s = 0; for (c in wort) if (c.isDigit()) s += c.digitToInt(); return s }; quersumme("a1b22")', '5'],
];

// Known gaps: documented in docs/kotlin-surface.md, deliberately not implemented.
const gaps = [
  'fun spr(vararg x: Int) = x.sum(); spr(*intArrayOf(1, 2))', // the spread operator; `spr(1, 2)` works
  'String(charArrayOf(\'a\'))',   // would hide `String.format`; `concatToString()` works
  'kotlin.math.abs(-5)',        // fully qualified calls (import + abs(-5) works)
  'Math.abs(-1)',               // Java, correctly unavailable
  'mapOf(1 to 2).forEach { k, v -> }', // the JVM's two-parameter form; `forEach { it.key }` works
];

// Messages for missing names: BlueK says which side the gap is on instead of
// passing Kotlite's generic wording through. Three cases, see KotlinSurfaceHints.
const messages = [
  // Arrays check their bounds and keep `Array<Int>` and `IntArray` apart, as in Kotlin (RT-96).
  ['val ar18 = IntArray(2); ar18[2] = 1', /Index 2 out of bounds for length 2/],
  ['val ar19: IntArray = arrayOf(1)', /Expected type is `IntArray`, but actual type is `Array<Int>`/],
  // 1. documented gap -> named alternative
  ['Math.abs(-1)', /`Math` belongs to Java and is not available in BlueK/],
  ['kotlin.math.abs(-5)', /does not support fully qualified calls.*import kotlin\.math\.abs/],
  ['val (d1, d2) = 5', /Destructuring declaration initializer of type Int must have a 'component1\(\)' function/],
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
