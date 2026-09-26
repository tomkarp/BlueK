# Kotlite in BlueK

BlueK führt Schülercode mit [Kotlite](https://github.com/sunny-chung/kotlite)
aus, einer Kotlin-Multiplatform-Bibliothek von Sunny Chung (MIT). Kotlite
interpretiert eine Teilmenge von Kotlin-Script. Dieses Dokument erklärt,
welche Kotlite-Teile im Bundle stecken, wie sie arbeiten und was BlueK
verändert hat. Die vollständige Änderungsliste steht in
[`vendor/kotlite-interpreter/PATCH.md`](../vendor/kotlite-interpreter/PATCH.md).

## Interpreter, kein Compiler

Kotlite übersetzt Kotlin weder in JavaScript noch in Bytecode. Es hat die
Stufen eines Compiler-Frontends, aber keine Codeerzeugung; ausgeführt wird der
analysierte Syntaxbaum selbst (AST-Interpretation, „tree walking“).

```text
 Quelltext ──▶ Lexer ──▶ Parser ──▶ SemanticAnalyzer ─────────────▶ Interpreter
              Tokens    AST          löst Namen zu eindeutigen      wertet AST-Knoten aus:
              mit       (ScriptNode, Symbolen auf, prüft und        suspend fun XNode.eval()
              Position  ClassDecl…,  inferiert Typen, wählt         CallStack aus Symboltabellen,
                        FunctionCall…) Überladungen, schreibt das   RuntimeValues (IntValue,
                                     Ergebnis in die AST-Knoten     ClassInstance, LambdaValue,
                                                                    DelegatedValue …)
 └──────────────── in BlueK: „Compile“ ────────────────┘ └── Ausführung (Codepad, main, Methoden) ──┘
```

- **Compile** in BlueK heißt: Lexer, Parser und `SemanticAnalyzer` über das
  ganze Projekt laufen lassen und die Top-Level-Deklarationen in einen neuen
  `Interpreter` laden. Analysefehler (Typfehler, unbekannte Namen,
  `val`-Neuzuweisung, private Zugriffe) entstehen hier, vor jeder Ausführung.
- **Ausführung** bedeutet, AST-Knoten im lebenden Interpreter auszuwerten.
  Objekte sind `ClassInstance`s; Instanzen von Unterklassen bestehen aus
  einer Kette von Teilen (`parentInstance`) für jede Oberklasse. Host-Objekte
  wie Listen stecken als `DelegatedValue` in Kotlin/JS-Collections.
- `CodeGenerator.kt` erzeugt aus einem AST nur wieder Kotlin-Quelltext
  (Debugging); BlueK nutzt ihn nicht.
- Kompiliert wird nur zur **Build-Zeit**: Der Interpreter selbst und
  `KotliteSession` werden mit Kotlin/JS nach JavaScript übersetzt.

Warum ein Interpreter? Der echte Kotlin-Compiler läuft auf der JVM und ist für
den Browser zu groß. Der Interpreter läuft komplett im Web Worker, hält eine
dauerhafte Sitzung für Codepad und Objektbank, kann Felder passiv lesen und
die Ausführung für Eingaben anhalten.

## Upstream, Fork und vendor – was wird tatsächlich benutzt?

| Bestandteil | Herkunft | im Bundle? |
| --- | --- | --- |
| Interpreter | `vendor/kotlite-interpreter/`: Upstream 1.1.2 (Commit `c78dbc5`) plus alle BlueK-Änderungen, Version `1.1.2-bluek.1` | **ja – ausschließlich dieser** |
| Upstream `kotlite-interpreter` 1.1.2 von Maven Central | in `kotlite-browser/build.gradle.kts` deklariert | **nein**, wird ersetzt (siehe unten) |
| `kotlite-stdlib` 1.1.0 | Maven Central, vorkompilierte klib (gegen Interpreter 1.1.0, Kotlin 1.9.23) | ja, unverändert, gegen den vendorten Interpreter gelinkt |
| GitHub-Fork [tomkarp/kotlite](https://github.com/tomkarp/kotlite) | drei Commits auf `c78dbc5` (erweiterte Builtins über wiederholte Analyse, private Properties, Backing-Felder) | nein; nur historischer Ausgangspunkt |

**Der Ersetzungsmechanismus:** `kotlite-browser/settings.gradle.kts` enthält
`includeBuild("../vendor/kotlite-interpreter")`. Der eingebundene Build
veröffentlicht die Koordinate `io.github.sunny-chung:kotlite-interpreter`.
Gradle ersetzt damit jede Abhängigkeit auf diese Koordinate unabhängig von der
Version – die direkte Deklaration 1.1.2 in `kotlite-browser` ebenso wie die
transitive Abhängigkeit 1.1.0 der Stdlib. Im gebauten Bundle erscheint der
Interpreter deshalb als Modul `kotlite-interpreter` (aus `vendor/`) und
enthält die BlueK-Erweiterungen; ein Upstream-Interpreter ist nicht enthalten.

**Folgen der binären Stdlib:** `kotlite-stdlib` 1.1.0 wurde gegen die alte
Interpreter-API kompiliert. Der Fork muss die von ihr benutzten Signaturen
kompatibel halten, sonst scheitert das Linken. Ihre Callbacks sind synchrone
Kotlin-Funktionen und kennen weder Inline-Metadaten noch Suspension; dafür
gibt es `StdlibInlineMetadata` (fehlende Inline-Metadaten), die Wiederholung
suspendierter Callbacks (siehe [Suspendierende Lambdas in der
Stdlib](#suspendierende-lambdas-in-der-stdlib)) und
`ExecutionEnvironment.patchFunction` (suspendierbares `count { }`,
`removeAll { }` und `retainAll { }` auf `MutableList`; `String.substring` mit
Kotlins Bereichsprüfung statt JavaScripts Begrenzung, RT-39). Ihre Ausnahmen sind
Kotlin-Ausnahmen des Hosts, keine Kotlite-Werte; `TryNode.eval` ordnet sechs Standardklassen
(`NumberFormatException`, `IllegalArgumentException`, `IllegalStateException`,
`IndexOutOfBoundsException`, `NoSuchElementException`, `ArithmeticException`)
den gleichnamigen Kotlite-Klassen zu, damit `catch` sie wie selbst geworfene
Ausnahmen nach Typ fängt (RT-38). Siehe [Technische Schulden](#technische-schulden).

**Maßgeblich ist `vendor/`.** Der Quellstand dort ist dem GitHub-Fork um
rund 1.800 Zeilen voraus (gegenüber Upstream: 38 Dateien, +1.895/−372 Zeilen). Änderungen an der Sprachsemantik werden direkt in
`vendor/kotlite-interpreter/` gemacht und in `PATCH.md` festgehalten.
`vendor/kotlite-interpreter/CHANGELOG.md` ist das unveränderte Upstream-
Changelog. Upstream-Tests sind nicht vendort; der Fork wird über die
BlueK-Smokes geprüft.

## Schichten im Bundle

```text
 bluek-kotlite-browser.js
 ├─ kotlite-browser (BlueK, Kotlin)
 │   ├─ KotliteSession      Sitzung, Namensraum, Handles, I/O, Manifest, native BluePlay-Engine
 │   ├─ BluePlayLibrary     Kotlin-Quelltext von World/Actor/Image (wird interpretiert)
 │   ├─ BlueKStdlibModule   native Stdlib-Ergänzungen (minOf, sum, String als Zeichenfolge …)
 │   ├─ KotlinSurfaceHints  verständliche Meldungen für fehlende Namen
 │   └─ RuntimeScheduler    Checkpoint-/Sleep-Fortsetzung über setTimeout
 ├─ kotlite-stdlib 1.1.0 (Upstream, binär)
 │   Core, Collections, Text, Math, Range, Regex, Byte, IO, KDateTime, UUID –
 │   generiert aus Kotlin-Deklarationen, Implementierungen rufen die echte
 │   Kotlin-Stdlib nativ auf
 └─ kotlite-interpreter (vendor/, Fork)
     Lexer, Parser, SemanticAnalyzer, ReplAnalyzer, Interpreter, Modelle,
     GenericCollectionsModule (filterIsInstance), ThreadClass (Thread.sleep),
     Wiederholung suspendierter Stdlib-Callbacks (ReplayableNativeCall,
     StdlibReplayMetadata)
```

Host-Funktionen und -Klassen werden über `ExecutionEnvironment` registriert
(`CustomFunctionDefinition`, `ProvidedClassDefinition`, `LibraryModule`).
Native Funktionen laufen als kompiliertes JavaScript; nur Schülercode und die
BluePlay-Klassen werden interpretiert.

## Was der Fork gegenüber Upstream ändert

Überblick nach Themen; Einzelheiten und Testabdeckung in `PATCH.md`.

| Thema | Änderungen |
| --- | --- |
| Dauerhafte Sitzung (REPL) | `ReplAnalyzer` als Analyse-Einstieg für wachsenden Sitzungsquelltext; Namensfreigabe an historischen Grenzen im `SemanticAnalyzer`; eingebaute Erweiterungsfunktionen bleiben über wiederholte Analysen auflösbar; Umordnen vorwärts referenzierter Klassen |
| Suspendierbare Ausführung | `eval` aller Knoten als `suspend`; `CustomFunctionDefinition.suspendExecutable`; `checkpointHook` in Schleifen; `runImmediately` als synchrone Kompatibilitätsgrenze; Wiederholung von Stdlib-Aufrufen mit suspendiertem Callback (`isReplayable`, `callReplayable`, `StdlibReplayMetadata`), `canSuspend`; `Thread.sleep` mit injiziertem `sleepHandler` |
| Inspektion und Lebensdauer | `ClassInstance.readBackingPropertyByDeclaredName` (Feld lesen ohne Getter); `reachableRuntimeValues` und `retainedRuntimeValues` für die Erreichbarkeit |
| Sprache | `private` Funktionen und Properties (inkl. `private set`), Backing-Feld `field` in eigenen Accessoren, geerbte Methoden über implizites `this`, `inline`/`reified`/`noinline`/`crossinline` mit nichtlokalen Returns, Kovarianz von `List`/`Collection`/`Iterable`, Imports (`ScriptNode.imports`), Standardausnahmen (auch aus nativen Funktionen nach Klasse fangbar), `ArithmeticException` bei Ganzzahldivision durch 0, `InterpreterStateException` für Interpreterfehler und Grenzen wie `readln()` in `toString()` (von keinem `catch` gefangen), `Float` als `Double` (auch `1.5f`), Typinferenz aus deklariertem Property-Typ, Compilefehler für Properties ohne Wert, eigene Meldung für sekundäre Konstruktoren, `;` nach Membern |
| Ausgabe und Meldungen | Kotlin-Formate (`6.0`, `[1, 2]`), Argumenttypen in „No matching function“ |
| Bibliothek | `GenericCollectionsModule` (`filterIsInstance`), gemeinsame Laufzeit-Typprüfung `acceptsRuntimeType`, `StdlibInlineMetadata` |
| Performance | Symboltabellen legen Maps erst beim Schreiben an; Typ-Caches pro Klassendefinition bzw. Interpreter; `ClassMemberResolver` merkt sich Signaturen; weniger Typauflösung pro Aufruf (siehe [blueplay.md](blueplay.md#performance)) |

Die Sprachgrenzen aus Sicht der Schülerinnen und Schüler stehen im README
unter „Aktuelle Grenzen“, die Stdlib-Oberfläche in
[kotlin-surface.md](kotlin-surface.md), Generics in
[kotlite-generics.md](kotlite-generics.md). Upstreams eigene Sprachtabelle:
`doc/usermanual/Language.adoc` im Kotlite-Repository.

## Wie BlueK den Interpreter benutzt

Kotlite hat keine öffentliche REPL. `KotliteSession` erzeugt einmal einen
`Interpreter` für ein leeres Skript und hängt jede Aktion als Quelltext an:
`ReplAnalyzer` analysiert den gesamten Sitzungsquelltext neu, ausgewertet
werden nur die neuen AST-Knoten (`Interpreter.evaluateNode`). Einzelheiten zu
Ablauf, Handles und Namensfreigabe: [architecture.md](architecture.md#ausführungsmodell-inkrementelle-analyse).

Asynchron gestartete Ausführungen (`startEvaluate`, `startLoadProject`,
`startCreate`, …) laufen als Kotlin-Coroutine ohne Dispatcher. Eine
Suspension (Eingabe, Checkpoint, `sleep`) gibt die Kontrolle an die
Event-Schleife des Workers zurück; die Fortsetzung kommt über `setTimeout`
oder eine Eingabeantwort. Die synchronen Methoden (`evaluate`, `load`,
`create`, `bind` …) schalten den Checkpoint-Hook ab und lehnen Suspension ab.
Die Oberfläche nutzt davon nur `bind`; die Node-Smokes verwenden sie
ausgiebig.

### Suspendierende Lambdas in der Stdlib

Die binäre Stdlib ruft Lambdas synchron auf (`LambdaValue.execute` →
`runImmediately`). Damit `forEach { readln() }`, `map { … }` mit
`Thread.sleep()` oder eine lange Schleife in `filter { … }` trotzdem
funktionieren, behandelt der Interpreter diese Grenze so (RT-37):

- **Wiederholung statt Abbruch:** Alle Stdlib-Funktionen mit
  Funktionsparameter (Module `Core`, `Collections`, `Text`, `Byte`, etwa
  `forEach`, `map`, `filter`, `let`, `repeat`, `sortedBy`, `groupBy`,
  `getOrPut`, `joinToString { }`) sind als `isReplayable` markiert
  (`StdlibReplayMetadata`). Der Interpreter merkt sich jedes
  Callback-Ergebnis. Suspendiert ein Callback, wird der native Stdlib-Aufruf
  verlassen; das Lambda wartet mit seinen Scopes auf dem Aufrufstapel weiter.
  Ist es fertig, läuft der native Aufruf erneut von vorn und erhält die
  gemerkten Ergebnisse, statt die Lambdas noch einmal auszuführen.
  Schülercode, Ausgabe und Ausnahmen laufen also genau einmal; nur die
  seiteneffektfreie Stdlib-Implementierung rechnet mehrfach.
- **In-place-Filter:** `MutableList.removeAll { }`/`retainAll { }` verändern die
  Liste zwischen den Callbacks und werden nicht wiederholt. BlueK ersetzt sie
  wie `count { }` per `patchFunction` durch suspendierbare Fassungen, die
  erst alle Prädikate auswerten und dann die Liste ändern.
- **Checkpoints:** Innerhalb eines synchronen Callbacks gibt eine Schleife
  nie an den Worker ab (die per `patchFunction` ersetzten `count`,
  `removeAll` und `retainAll` rufen ihr Lambda suspendierbar auf und sind
  davon ausgenommen); sonst müsste der Stdlib-Aufruf alle 128 Iterationen
  wiederholt werden. Lange Rechnungen in solchen Lambdas blockieren den
  Worker deshalb wie tiefe Rekursion, bis sie fertig sind.
- **Nicht unterbrechbare Callbacks:** `toString()`, `equals()`, `hashCode()`
  und `compareTo()` werden auch aus Interpreter und Stdlib synchron
  aufgerufen, ebenso die Callbacks anderer nativer Funktionen (BluePlay,
  `withDefault`-Lambdas). Dort meldet `readln()`/`Thread.sleep()` einen
  verständlichen Fehler (`Interpreter.canSuspend` ist `false`), statt den
  Aufrufstapel zu beschädigen; Schleifen laufen dort ohne Abgabe durch. Der
  Fehler entsteht vor jeder Suspension. Er ist eine Grenze von BlueK, keine
  Ausnahme des Programms: Als `InterpreterStateException` fängt ihn kein
  `catch` des Programms (RT-38).
- Kosten: pro Callback ein gemerktes Ergebnis, bis der Stdlib-Aufruf endet.
  Gemessen (Node): BluePlay-Tick im Rauschen unverändert, lambda-lastige
  Schleifen (`(1..200000).forEach`, `map`/`filter` über 100 000 Elemente)
  etwa 3–8 % langsamer.

## Technische Schulden

- **Synchrone Stdlib-Callbacks:** Seit RT-37 werden Stdlib-Aufrufe mit
  suspendiertem Lambda wiederholt (siehe [oben](#suspendierende-lambdas-in-der-stdlib)).
  Das setzt voraus, dass die binäre Stdlib bis zur Rückkehr keine eigenen
  Seiteneffekte hat; neue Stdlib-Funktionen, die ihren Empfänger zwischen
  Callbacks ändern, müssen in `StdlibReplayMetadata` ausgenommen werden.
  Fügt ein Lambda der Collection, über die der wiederholte Aufruf läuft,
  Elemente hinzu oder entfernt welche (in Kotlin eine
  `ConcurrentModificationException`), wird das nicht erkannt. Schleifen in
  solchen Lambdas geben nicht an den Worker ab. Eine vendorte, suspendierbare
  Stdlib würde beides beheben.
- **Ausnahmen aus der Stdlib:** Nur die sechs oben genannten Standardklassen
  werden zugeordnet. Andere Host-Ausnahmen, etwa
  `UnsupportedOperationException` (der Interpreter wirft sie auch für eigene
  nicht unterstützte Pfade), sind nur mit `catch (e: Throwable)` fangbar.
  Native Ausnahmen haben keinen Kotlite-Stacktrace. (RT-38)
- **Vorwärtsverweise:** Upstream analysiert Deklarationen sequenziell.
  `ReplAnalyzer` erkennt fehlende Klassen an Fehlermeldungen, schiebt die
  Klasse direkt vor die Deklaration, die sie brauchte, und analysiert erneut.
  Jeder Versuch kostet einen vollständigen Analyse-Durchlauf; Schülercode wird
  dabei nie erneut ausgeführt. Die endgültige Lösung ist eine
  Zwei-Pass-Deklarationsanalyse.
- **Keine inkrementelle Symboltabelle:** Jede Aktion analysiert den gesamten
  Sitzungsquelltext.
- **Fork-Repository veraltet:** siehe oben; entweder den `vendor/`-Stand
  zurück in den Fork übertragen oder den Fork nicht mehr als Quelle nennen.
