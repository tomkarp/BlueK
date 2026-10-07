# Kotlin-Oberfläche von BlueK

BlueK kompiliert Kotlin nicht, sondern interpretiert es mit
[Kotlite](https://github.com/sunny-chung/kotlite) (siehe [kotlite.md](kotlite.md)).
Kotlite bildet eine Teilmenge von Kotlin ab; alles, was Schülercode darüber
hinaus erwartet, muss BlueK selbst bereitstellen. Diese Seite hält fest, welche
Standardbibliothek zugesagt ist — und welche nicht. Sprachkonstrukte
(`data class`, `object`, Destrukturierung …) stehen im README unter „Aktuelle
Grenzen“.

Maßgeblich ist nicht dieser Text, sondern `scripts/smoke-kotlin-surface.mjs`:
dort steht jeder Eintrag als ausführbarer Ausdruck, und die bekannten Lücken
sind als solche markiert. Der Test läuft in `npm run test:regression` mit und
schlägt auch an, wenn eine Lücke nach einem Kotlite-Update von selbst
verschwindet. Nach Kotlin-Änderungen zuerst `npm run build:kotlite`.

## Herkunft

| Quelle | Inhalt |
| --- | --- |
| `kotlite-stdlib` 1.1.0 | Listen, Maps, Sets, Ranges, `kotlin.math`, der Großteil von `String` |
| `BlueKStdlibModule` | Die unten gelisteten Ergänzungen |
| `KotliteSession` | Host-Funktionen (`readln`, BluePlay, Ton, Eingabe) und per `patchFunction` ersetzte Stdlib-Funktionen: suspendierbares `count { }`, `removeAll { }`/`retainAll { }`, `substring` mit Kotlins Bereichsprüfung |
| `vendor/kotlite-interpreter` | Interpreter-Semantik sowie `filterIsInstance` und `Thread.sleep`, siehe `vendor/kotlite-interpreter/PATCH.md` |

Fehlt eine reine Stdlib-Funktion, gehört sie in `BlueKStdlibModule`, nicht in den
Fork. Sie wird dort als native `CustomFunctionDefinition` registriert und nicht
als interpretiertes Kotlin geschrieben: BluePlay ruft einen Teil davon pro Frame
und Actor auf, und ein interpretierter Rumpf kostet dort mehr als ein nativer.

## Ergänzt durch BlueK

**Zahlen.** `minOf` / `maxOf` für `Int` und `Double` (zwei bis beliebig viele
Werte), `coerceIn` / `coerceAtLeast` / `coerceAtMost` für `Int` und `Double`,
`Int.MAX_VALUE` / `Int.MIN_VALUE`, `Double.MAX_VALUE` / `MIN_VALUE` /
`POSITIVE_INFINITY` / `NEGATIVE_INFINITY` / `NaN`, `Char.MIN_VALUE` /
`MAX_VALUE` (RT-59), `Int.toChar()`, `Char.code`, `Char.digitToInt()`.
Bit-Operationen `and`, `or`, `xor`, `shl`, `shr`, `ushr` (infix) und `inv()`
für `Int` und `Long` (RT-87).

**Listen und Ranges.** `emptyList()` und `emptySet()` (Typ aus dem Ziel wie
`val leer: List<Int> = emptyList()`, `karten[name] ?: emptyList()` oder dem
Rückgabetyp, RT-93), `sum()` (`Int`, `Double`), `average()`, `sumOf { }`,
`reduce { }`, `flatten()`, `indices`, `chunked(n)`, `windowed(n, step,
partialWindows)` (RT-59). Ranges sind mit erfasst, `(1..4).sum()`
funktioniert ebenso wie `listOf(1,2).sum()`. Zeichenbereiche wie `'a'..'z'`
lassen sich durchlaufen (`for (c in 'a'..'z')`), mit `toList()` umwandeln und
mit `count()` zählen (RT-59).

**String als Zeichenfolge.** `for (c in wort)`, `wort[i]`, `split(String)`,
`split(Char)`, `toList()`, `indices`, `lines()`, `zip(anderes)`,
`count { }` (RT-59).

**Maps.** `entries` als `Set` der Einträge (RT-58), `containsKey(k)` und
`getOrDefault(k, standard)` (RT-59). Einträge werden wie in
Kotlin als `a=1` ausgegeben und nach Schlüssel und Wert verglichen; das gilt
auch für Einträge aus `for (e in map)`, `forEach { }` oder `maxByOrNull { }`.

**Triple, StringBuilder, Random (RT-62).** `Triple(a, b, c)` mit `first`,
`second`, `third`, Ausgabe `(a, b, c)` und Inhaltsvergleich; `StringBuilder()`
bzw. `StringBuilder("text")` mit `append`, `appendLine`, `insert`, `reverse`,
`clear`, `isEmpty()`, `length`, `sb[i]` und `toString()`; `buildString { }`
(darin auch `readln()`); `Random.nextInt()`, `nextInt(bis)`,
`nextInt(von, bis)`, `nextDouble()` (auch mit Grenzen) und `nextBoolean()`,
mit oder ohne `import kotlin.random.Random`.

**String als Zeichenfolge (RT-94).** `String` ist in Kotlite kein
`Iterable`; die üblichen Funktionen von Kotlins `CharSequence` sind einzeln
nachgerüstet: `ifBlank { }`, `ifEmpty { }`, `replaceFirstChar { }` (mit `Char`-
oder `String`-Ergebnis), `indexOf`/`lastIndexOf` mit `Char`, `map`,
`mapIndexed`, `find`, `findLast`, `single { }`, `sumOf { }`,
`groupBy`, `associateWith`, `toSet()`, `toMutableList()`, `chunked(n)`,
`windowed(n)`, `maxOrNull()`, `minOrNull()`, `elementAt`, `withIndex()`,
`trimIndent()`, `trimMargin()`, `toLong()`, `toLongOrNull()`; dazu
`Char.digitToIntOrNull()`, `Int.mod`, `Int.rem`, `Int.toString(radix)`,
`Int.toFloat()` (als `Double`) und `Long.MAX_VALUE`/`MIN_VALUE`.

**Vergleicher und weitere Sammlungsfunktionen (RT-95).** `Comparator<T>` mit
`compareBy` (ein bis drei Selektoren), `compareByDescending`, `naturalOrder()`,
`reverseOrder()`, `Comparator<T> { a, b -> … }`, `thenBy`,
`thenByDescending`, `reversed()` und `compare(a, b)`; dazu `sortedWith`
(mit Vergleicher oder Lambda `{ a, b -> … }`), `sortWith`, `maxWith`,
`minWith`. Die Typvariable eines Vergleichers wird aus der Deklaration
(`val c: Comparator<Person> = compareBy { it.alter }`) und seit RT-100 auch aus
dem äußeren Aufruf abgeleitet: `personen.sortedWith(compareBy({ it.alter },
{ it.name }))`, `compareBy { it.alter }.thenBy { it.name }`,
`sortedWith(reverseOrder())`. Listen: generisches `sumOf { }`
(`Int`, `Long`, `Double`), `slice`, `zipWithNext()`, `ifEmpty { }`,
`add(index, element)`, `addFirst`, `addLast`, `reverse()`, `removeIf { }`,
`associateBy { }`; Maps: `putAll`, `toSortedMap()`, `emptyMap()`,
`hashMapOf`; Konstruktoren im Java-Stil `ArrayList<T>()`, `HashMap<K, V>()`,
`arrayListOf`, `hashSetOf`, `Set.random()` und `measureTimeMillis { }`.
Kotlite 1.1.0 deklariert zusätzlich ein falsches
`Iterable<K>.associateBy(valueSelector)`, das jeden `associateBy`-Aufruf
mehrdeutig machte; BlueK registriert diese Überladung nicht.

**Arrays (RT-96).** `Array<T>`, `IntArray`, `LongArray`, `DoubleArray`,
`BooleanArray` und `CharArray` mit `arrayOf`, `intArrayOf` … `charArrayOf`,
`Array(n) { i -> … }`, `IntArray(n)` (mit `0`, `0.0`, `false`, `'\u0000'`
gefüllt) und `IntArray(n) { … }`, `arrayOfNulls<T>(n)`, `emptyArray<T>()`,
`toTypedArray()`, `toIntArray()` usw. und `String.toCharArray()`. Ein Array
hat feste Größe; `a[i] = x` prüft die Grenzen wie die JVM
(„Index 3 out of bounds for length 3“). Dazu `contentToString()`,
`contentEquals`, `fill`, `reverse()`, `shuffle()`, `sort()`,
`sortDescending()`, `sortBy { }`, `sortByDescending { }`, `sortWith`,
`sortedArray()`, `copyOf()`, `copyOfRange`, `a + x`, `asList()` und
`CharArray.concatToString()`. `==` vergleicht wie in Kotlin die Identität,
`contentEquals` den Inhalt. Mehrdimensional: `Array(3) { IntArray(3) }` mit
`feld[y][x]`. `fun main(args: Array<String>)` startet wie `main()` und
bekommt ein leeres Array.

In BlueK ist jedes Array zugleich eine `List` seines Elementtyps. Deshalb
gelten `size`, `indices`, `lastIndex`, `for`, `in`, `sum()`, `average()`,
`max()`, `map`, `filter`, `joinToString`, `sorted()` und alle anderen
Listenfunktionen ohne eigene Definition. Abweichungen von Kotlin:
`val l: List<Int> = intArrayOf(1)` wird angenommen, und
`println(array)` gibt den Inhalt aus (`[1, 2]`, Kotlin/JVM `[I@1b6d3586`).

**Formatierung (RT-66).** `"%.2f".format(x)` und `String.format("%d", n)` wie
`java.util.Formatter` mit `%d %x %X %o %f %s %S %c %b %% %n`, Breite,
Genauigkeit, Argumentindex (`%2$s`, im Kotlin-Quelltext `%2\$s`) und den Flags
`- 0 + , Leerzeichen`. `%f` rundet wie Java kaufmännisch auf der kürzesten
Dezimaldarstellung (`"%.1f".format(0.15)` ist `0.2`). Falsche Typen
(`"%d".format(1.5)`) und fehlende Argumente werfen `IllegalArgumentException`.

**Fehler melden (RT-73).** `error("Meldung")` wirft wie in Kotlin eine
`IllegalStateException` mit dieser Meldung; der Rückgabetyp `Nothing` erlaubt
`val x: Int = if (ok) 1 else error("…")` und `?: error("…")`.

**Destrukturierung (RT-65).** `component1()` … für `Pair`, `Triple`,
Map-Einträge, Listen (`component1` bis `component5`) und `IndexedValue`;
`withIndex()` liefert eine Liste von `IndexedValue` mit `index` und `value`
(Ausgabe `IndexedValue(index=0, value=a)`). Ohne `componentN` meldet BlueK
Kotlins „Destructuring declaration initializer … must have a 'component1()'
function“.

**Nullable Empfänger.** `toString()`, `equals()` und `hashCode()` auf `T?`
(`Any?.toString()` liefert `"null"`, `hashCode()` von `null` ist `0`). Eigene
Überschreibungen in der Klasse werden auch über einen nullable Empfänger
aufgerufen. Mit `?.` (`n?.toString()`, `s?.equals("a")`) gilt wie in Kotlin
die Funktion des nicht-nullable Typs; die `Any?`-Fassung kommt dort nicht zum
Zug, und der Aufruf ist nicht mehrdeutig (RT-44).

## Abweichungen von echtem Kotlin

- `minOf(vararg values: Int)` statt Kotlins `minOf(a, vararg other)`. Kotlite
  erlaubt `vararg` nur als einzigen Parameter. Folge: `minOf()` ohne Argumente
  wird von der Analyse akzeptiert und scheitert erst zur Laufzeit.
- Formatierung nutzt immer `.` als Dezimalpunkt und `,` als Tausendertrenner
  (Kotlin/JVM: Sprache des Rechners, auf deutschen Systemen `3,14`). `%e`, `%g`,
  `%t` und das Flag `(` fehlen.
- `Random(seed)` für reproduzierbare Zufallszahlen fehlt; `Random` ist nur als
  `Random.nextInt(...)` usw. nutzbar. `StringBuilder` hat nur die oben
  gelisteten Funktionen.
- `map.entries` ist eine Momentaufnahme statt einer Live-Ansicht: Wird die Map
  danach verändert, bleibt die Menge wie sie war (Kotlin/JVM: sie ändert sich
  mit). Die Einträge selbst bleiben lesbar.
- `String.indices` und `List.indices` liefern `List<Int>` statt `IntRange`.
  `for (i in wort.indices)` verhält sich gleich; Range-eigene Operationen nicht.
- `sumOf { }` gibt es nur in der `Int`-Variante — Kotlite unterscheidet
  Überladungen nicht am Rückgabetyp des Lambdas.
- Gemischte Zahlentypen lösen nicht auf: `minOf(3, 2.5)` findet keine Überladung.
- `Float` ist durchgängig `Double` (bereits vor dieser Seite so).
- Ungültige Indizes in `substring` werfen `IndexOutOfBoundsException`; die
  JVM-Unterklasse `StringIndexOutOfBoundsException` gibt es in BlueK nicht
  (RT-39).
- `StackOverflowError` entsteht nach genau 1000 verschachtelten Aufrufen statt
  abhängig von der Stack-Größe, und `message` nennt die Grenze und die übliche
  Ursache (Kotlin/JVM: `null`). `Error` und `StackOverflowError` sind als
  Klassen vorhanden, andere `Error`-Unterklassen nicht (RT-42).
- Ein Accessor, der seine eigene Property statt `field` benutzt, ergibt beim
  Compile eine Warnung, ähnlich IntelliJs Hinweis „Recursive property
  accessor“ (RT-43).

## Bekannte Lücken

| Lücke | Stand |
| --- | --- |
| Spread-Operator `f(*array)` | Parser kennt `*` vor Argumenten nicht; Werte einzeln übergeben (`f(1, 2)`) |
| `String(charArray)` | Eine Funktion `String(…)` verdeckte `String.format`; `chars.concatToString()` oder `joinToString("")` funktionieren |
| `kotlin.math.abs(-5)` als qualifizierter Aufruf | `import kotlin.math.abs` und dann `abs(-5)` funktioniert |
| `Math.abs`, `java.*` | Java, bewusst nicht verfügbar |
| `map.forEach { k, v -> }` | Java-Form mit zwei Parametern; eingebaute Überladungen, die sich nur in der Parameterzahl des Lambdas unterscheiden, kollidieren in Kotlite. `map.forEach { (k, v) -> }` (RT-65) und `map.forEach { it.key … it.value }` funktionieren |

Außerhalb dieser Tabelle fehlen weitere Funktionen der Kotlin-Bibliothek. Sie
sind nicht Teil der Lückenliste im Test; BlueK meldet sie mit den allgemeinen
Fällen unten (Vorschlag eines ähnlichen Namens oder „unknown“).

## Fehlermeldungen bei fehlenden Namen

Kotlite meldet einen fehlenden Namen generisch („No matching function …"),
was wie ein Tippfehler des Schülers aussieht, auch wenn sein Kotlin korrekt
ist. `KotlinSurfaceHints` schreibt diese Meldungen um. BlueK kann „Lücke" und
„Tippfehler" nicht allgemein unterscheiden — es kennt seine eigenen Namen,
aber nicht den vollen Kotlin-Umfang — und antwortet deshalb in drei Fällen:

| Fall | Beispiel | Meldung |
| --- | --- | --- |
| Name steht in der Lückentabelle oben | `Math.abs(-1)` | „`Math` belongs to Java and is not available in BlueK …" |
| Name liegt dicht an einem bekannten | `minOff(1, 2)` | „`minOff` is not available in BlueK. Did you mean `minOf`?" |
| sonst | `bruttosumme(5)` | „… is unknown: neither declared in this project nor provided by BlueK …" |

Der dritte Fall entscheidet bewusst nicht, sondern nennt beide Möglichkeiten
(und die dritte: noch nicht geschrieben), statt dem Schüler einen Fehler zu
unterstellen.

**Wichtige Ausnahme:** Kotlite benutzt für „Name existiert nicht" und „Name
existiert, aber die Argumenttypen passen nicht" denselben Wortlaut. Ist der
Name im Projekt deklariert oder von BlueK bereitgestellt, bleibt Kotlites
Meldung stehen — nur sie nennt die Argumenttypen. Beispiel: `zeige(5)` bei
`fun zeige(text: String)` meldet weiterhin „argument types (Int)".

**Nullable Empfänger:** Ruft man ein Mitglied mit `.` auf einem Wert vom Typ
`T?` auf (`alle.add(x)` bei `var alle: MutableList<Mensch>?`), existiert das
Mitglied, nur der Aufruf ist unsicher. Der Semantic Analyzer meldet dann wie
kotlinc „Only safe (?.) or non-null asserted (!!.) calls are allowed on a
nullable receiver of type 'MutableList<Mensch>?'." (Patch in
`vendor/kotlite-interpreter/PATCH.md`); `KotlinSurfaceHints` reicht diese
Meldung unverändert durch. Ein Mitglied, das es auch für `T` nicht gibt,
bleibt „unknown“.

Die Lückentabelle oben, die `gaps`-Liste im Smoke-Test und diese Meldungen
stammen aus derselben Quelle und werden vom Test zusammengehalten.

## kotlin.test (2026-10-06)

Native skalare Assertions in `BlueKStdlibModule`: `assertEquals<T>`,
`assertNotEquals<T>`, `assertTrue(Boolean)`, `assertFalse(Boolean)`, `assertNull`,
`assertNotNull<T>` und `fail`, jeweils mit optionaler Nachricht.
Double-Gleichheit entspricht dem generischen Vergleich (NaN gleich,
positive/negative Null verschieden). Nullable-Smartcasts nach `assertNotNull`
und bedingte Smartcasts nach `assertTrue`/`assertFalse` sind im Analyzer ergänzt.
Annotationen, Runner und Fixture-/Recording-Grenzen: [testing.md](testing.md).
Nachweise: `smoke-kotlin-surface.mjs`, `smoke-testing.mjs`; externer JVM-Lauf
mit `npm run test:testing:portable`.
