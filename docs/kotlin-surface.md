# Kotlin-Oberfläche von BlueK

BlueK führt Kotlin nicht aus, sondern interpretiert es mit
[Kotlite](https://github.com/sunny-chung/kotlite). Kotlite bildet eine Teilmenge
von Kotlin ab; alles, was Schülercode darüber hinaus erwartet, muss BlueK selbst
bereitstellen. Diese Seite hält fest, was zugesagt ist — und was nicht.

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
| `KotliteSession` | Host-Funktionen: `readln`, BluePlay, Ton, Eingabe |
| `vendor/kotlite-interpreter` | Nur Interpreter-Semantik, siehe `vendor/kotlite-interpreter/PATCH.md` |

Fehlt eine reine Stdlib-Funktion, gehört sie in `BlueKStdlibModule`, nicht in den
Fork. Sie wird dort als native `CustomFunctionDefinition` registriert und nicht
als interpretiertes Kotlin geschrieben: BluePlay ruft einen Teil davon pro Frame
und Actor auf, und ein interpretierter Rumpf kostet dort mehr als ein nativer.

## Ergänzt durch BlueK

**Zahlen.** `minOf` / `maxOf` für `Int` und `Double` (zwei bis beliebig viele
Werte), `coerceIn` / `coerceAtLeast` / `coerceAtMost` für `Int` und `Double`,
`Int.MAX_VALUE` / `Int.MIN_VALUE`, `Int.toChar()`, `Char.code`,
`Char.digitToInt()`.

**Listen und Ranges.** `sum()` (`Int`, `Double`), `average()`, `sumOf { }`,
`reduce { }`, `flatten()`, `indices`. Ranges sind mit erfasst, `(1..4).sum()`
funktioniert ebenso wie `listOf(1,2).sum()`.

**String als Zeichenfolge.** `for (c in wort)`, `wort[i]`, `split(String)`,
`split(Char)`, `toList()`, `indices`.

## Abweichungen von echtem Kotlin

- `minOf(vararg values: Int)` statt Kotlins `minOf(a, vararg other)`. Kotlite
  erlaubt `vararg` nur als einzigen Parameter. Folge: `minOf()` ohne Argumente
  wird von der Analyse akzeptiert und scheitert erst zur Laufzeit.
- `String.indices` und `List.indices` liefern `List<Int>` statt `IntRange`.
  `for (i in wort.indices)` verhält sich gleich; Range-eigene Operationen nicht.
- `sumOf { }` gibt es nur in der `Int`-Variante — Kotlite unterscheidet
  Überladungen nicht am Rückgabetyp des Lambdas.
- Gemischte Zahlentypen lösen nicht auf: `minOf(3, 2.5)` findet keine Überladung.
- `Float` ist durchgängig `Double` (bereits vor dieser Seite so).

## Bekannte Lücken

| Lücke | Stand |
| --- | --- |
| Arrays (`arrayOf`, `IntArray`, `Array(n) { }`) | Fehlt vollständig; eigenes Sprachfeature, bewusst offen. Der Lehrgang arbeitet mit `List`/`MutableList` |
| `"%.2f".format(x)`, `String.format` | Braucht eine eigene Formatstring-Implementierung |
| `withIndex()` | Braucht eine `IndexedValue`-Klasse |
| `"abc".map { }`, `toCharArray()`, `chunked`, `windowed` | `String` ist kein `Iterable`; nur die oben gelisteten Zugänge sind nachgerüstet |
| `kotlin.math.abs(-5)` als qualifizierter Aufruf | `import kotlin.math.abs` und dann `abs(-5)` funktioniert |
| `Math.abs`, `java.*` | Java, bewusst nicht verfügbar |
| `Double.MAX_VALUE`, `Char.MIN_VALUE` | Nicht nachgerüstet; `Int.MAX_VALUE`/`MIN_VALUE` gibt es |

## Fehlermeldungen bei fehlenden Namen

Kotlite meldet einen fehlenden Namen generisch („No matching function …"),
was wie ein Tippfehler des Schülers aussieht, auch wenn sein Kotlin korrekt
ist. `KotlinSurfaceHints` schreibt diese Meldungen um. BlueK kann „Lücke" und
„Tippfehler" nicht allgemein unterscheiden — es kennt seine eigenen Namen,
aber nicht den vollen Kotlin-Umfang — und antwortet deshalb in drei Fällen:

| Fall | Beispiel | Meldung |
| --- | --- | --- |
| Name steht in der Lückentabelle oben | `arrayOf(1, 2)` | „BlueK has no arrays. Use listOf(...) …" |
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

Die Lückentabelle oben, die `gaps`-Liste im Smoke-Test und diese Meldungen
stammen aus derselben Quelle und werden vom Test zusammengehalten.
