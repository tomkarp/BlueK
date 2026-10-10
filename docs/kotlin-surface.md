# Kotlin standard library in BlueK

BlueK uses `kotlite-stdlib` 1.1.0 plus native additions. This is a tested subset,
not the complete Kotlin standard library. Language features/limits are in
[kotlin-support.md](kotlin-support.md).

`scripts/smoke-kotlin-surface.mjs` is the executable coverage reference. Its
explicit gap cases also fail when a previously missing operation starts working,
so documentation can be updated. Developer placement/build rules:
[AGENTS.md](../AGENTS.md).

## Supported additions

| Area | Operations |
| --- | --- |
| Numbers | Int/Double minOf/maxOf (multiple values), coerceIn/coerceAtLeast/coerceAtMost; Int/Long limits; Double limits/infinities/NaN; Char limits/code/digitToInt/digitToIntOrNull; Int.toChar/mod/rem/toString(radix)/toFloat; Int/Long and/or/xor/shl/shr/ushr/inv; `Number` as supertype of Int/Long/Double/Byte with toInt/toLong/toDouble/toFloat/toByte |
| Collections/ranges | emptyList/emptySet/emptyMap, sum, average, sumOf, reduce, flatten, indices, chunked, windowed, character ranges, withIndex; slice, zipWithNext, ifEmpty, indexed add, addFirst/addLast, reverse, removeIf, associateBy; ArrayList/HashMap constructors, arrayListOf/hashMapOf/hashSetOf, Set.random |
| Maps | entries, containsKey, getOrDefault, putAll, toSortedMap; entries compare/hash by key and value and print as a=1 |
| String | character iteration/indexing, split(String/Char), toList, indices, lines, zip, count; ifBlank/ifEmpty, replaceFirstChar (Char/String result), Char indexOf/lastIndexOf, map/mapIndexed, find/findLast, single, sumOf, groupBy, associateWith, toSet/toMutableList, chunked/windowed, minOrNull/maxOrNull, elementAt, withIndex, trimIndent/trimMargin, toLong/toLongOrNull |
| Comparators | Comparator<T>, compareBy (1–3 selectors), compareByDescending, naturalOrder/reverseOrder, thenBy/thenByDescending, reversed, compare; sortedWith/sortWith/maxWith/minWith |
| Utility | Triple and its component properties/content equality; StringBuilder, buildString; Random.nextInt/nextDouble/nextBoolean; measureTimeMillis; error |
| Destructuring | Pair/Triple/map entries, list component1–5 and IndexedValue component methods; withIndex provides index/value |
| Nullable receivers | toString/equals/hashCode on T?, preserving overrides; safe calls use the non-null receiver's member |

`sumOf` supports selectors returning **Int, Long or Double**, using one generic
implementation rather than selecting overloads by lambda result type (RT-95).
Comparator/type inference uses declaration context, outer call arguments and
expected lambda results (RT-100). Specify type arguments for if branches where
inference lacks that context.

StringBuilder supports empty/String constructors, append/appendLine, insert,
reverse, clear, isEmpty, length, indexing and toString. Random supports unbounded
and bounded nextInt/nextDouble plus nextBoolean, with or without
`import kotlin.random.Random`; **Random(seed) is unavailable**.

## Qualified math names

The available top-level functions and constants from `kotlin.math` support
their qualified spelling without an import: `kotlin.math.abs(-3)`,
`kotlin.math.sqrt(16.0)`, `kotlin.math.max(3, 7)`, `kotlin.math.min(3, 7)`,
`kotlin.math.PI` and `kotlin.math.E`. They use the same native overloads as the
short names and stay distinct from project functions or variables named
`abs`, `sqrt` or `PI`. Local objects named `kotlin` still use ordinary member
access. Strings, comments and source locations are unchanged.

Qualification does not provide missing library members. Other package-qualified
library expressions are not supported yet; use the available short names.

## Arrays

Supported types: Array<T>, IntArray, LongArray, DoubleArray, BooleanArray,
CharArray. Constructors/factories: arrayOf and primitive variants, Array(n)
with initializer, primitive size/initializer constructors, arrayOfNulls,
emptyArray and collection-to-array conversions, including String.toCharArray.
Default primitive values are zero/false/null character; arrays have fixed size
and indexed writes check bounds.

Operations: contentToString/contentEquals, fill, reverse, shuffle, sort,
sortDescending/sortBy/sortByDescending/sortWith, sortedArray, copyOf/copyOfRange,
plus, asList and CharArray.concatToString. Multidimensional arrays work.
Equality is identity-based; contentEquals compares contents.

In BlueK arrays are also Lists, inheriting their operations. Thus
`val l: List<Int> = intArrayOf(1)` is accepted, and printing an array displays
contents rather than a JVM identity string. Spread `f(*array)` and
`String(charArray)` are unsupported; use concatToString or joinToString.

## Formatting

`"%.2f".format(x)` and `String.format("%d", n)` support
`%d %x %X %o %f %s %S %c %b %% %n`, width, precision, argument indices and
flags `-`, `0`, `+`, `,`, space. In Kotlin strings escape positional `$`,
for example `%2\$s`. `%f` rounds half-up from the shortest decimal representation;
`"%.1f".format(0.15)` gives `0.2`. Invalid types/missing arguments throw
IllegalArgumentException.

Formatting always uses `.` decimals and `,` grouping, regardless of system
locale. `%e`, `%g`, dates (`%t`) and the `(` flag are unsupported.

## Other differences and known gaps

- minOf/maxOf use a vararg-only declaration; no-argument calls may pass analysis
  then fail at runtime. Mixed number types such as minOf(3, 2.5) do not resolve.
- map.entries is a snapshot, not a live view.
- String/List indices return List<Int>, not IntRange; ordinary iteration works.
- Float is represented as Double.
- substring checks Kotlin bounds but throws IndexOutOfBoundsException, not the
  JVM-specific StringIndexOutOfBoundsException.
- StackOverflowError has a fixed call limit and explanatory message rather than
  depending on the JVM stack. AssertionError/NotImplementedError are also Error
  subclasses; not all JVM Error subclasses exist.
- Recursive accessors are compile warnings, not compile errors.

| Missing form | Alternative |
| --- | --- |
| `Math.abs`, java.* | Java APIs are deliberately unavailable |
| `map.forEach { k, v -> }` | `map.forEach { (k, v) -> }` or use it.key/it.value |
| `String(charArray)` | chars.concatToString() or joinToString("") |
| `f(*array)` | Pass individual arguments when suitable |

Other unlisted Kotlin functions may also be absent. The coverage script is a
specific contract, not a completeness claim.

## Missing-name diagnostics

KotlinSurfaceHints distinguishes known gaps (with alternatives), close spellings
(“Did you mean …?”) and unknown names (“neither declared in this project nor
provided by BlueK”). It cannot generally distinguish a typo from missing Kotlin
functionality. If a name already exists, preserve Kotlite's argument-type
mismatch diagnostic rather than rewriting it as missing.

Unsafe `.` on a nullable receiver gets the analyzer's safe-call/non-null-assertion
diagnostic; an actually missing member remains unknown. The explicit gap table,
coverage cases and hint metadata must remain consistent.

## kotlin.test

Seven native assertions: assertEquals, assertNotEquals, assertTrue, assertFalse,
assertNull, assertNotNull and fail, with optional messages. Generic Double
comparison equates NaN but distinguishes positive/negative zero. Supported
assertions participate in smart casts. Annotation/runner/state limits:
[testing.md](testing.md).

Developer references: `BlueKStdlibModule` (additions), `KotliteSession`
(host I/O and patched count/removeAll/retainAll/substring), vendored interpreter
(type semantics, filterIsInstance and Thread.sleep).
