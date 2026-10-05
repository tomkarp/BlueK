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
 │   ├─ KotliteSession      Sitzung, Namensraum, Handles, I/O, Manifest
 │   ├─ BluePlayEngine      native BluePlay-Engine: Welten, Actors, Kollision, Frames
 │   ├─ BluePlayLibrary     Kotlin-Quelltext von World/Actor/Image (wird interpretiert)
 │   ├─ BlueKStdlibModule   native Stdlib-Ergänzungen (minOf, sum, String als Zeichenfolge …)
 │   ├─ KotlinSurfaceHints  verständliche Meldungen für fehlende Namen
 │   └─ RuntimeScheduler    Zeitbudget für Checkpoints, Fortsetzung über Message-Channel
 │                          bzw. setTimeout (Sleep), frischer Stack über eine Microtask
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
| Dauerhafte Sitzung (REPL) | `ReplAnalyzer` als Analyse-Einstieg für wachsenden Sitzungsquelltext; Namensfreigabe an historischen Grenzen im `SemanticAnalyzer`; eingebaute Erweiterungsfunktionen bleiben über wiederholte Analysen auflösbar; neue Knoten in Auswertungsreihenfolge (Klassen, dann Funktionen); Quelltexteinheiten (`unitStarts`) |
| Suspendierbare Ausführung | `eval` aller Knoten als `suspend`; `CustomFunctionDefinition.suspendExecutable`; `checkpointHook` in Schleifen (synchrone Abfrage `isDue`, nur bei Bedarf `yield`); `runImmediately` als synchrone Kompatibilitätsgrenze; Wiederholung von Stdlib-Aufrufen mit suspendiertem Callback (`isReplayable`, `callReplayable`, `StdlibReplayMetadata`), `canSuspend`; `Thread.sleep` mit injiziertem `sleepHandler`; Aufruftiefe `maxCallDepth` und `stackResetHook` für tiefe Rekursion |
| Inspektion und Lebensdauer | `ClassInstance.readBackingPropertyByDeclaredName` (Feld lesen ohne Getter); `reachableRuntimeValues` und `retainedRuntimeValues` für die Erreichbarkeit |
| Sprache | Smart Casts nach `is`/`!is` und Null-Prüfungen (`&&`, `||`, `if`, `when`, `while`, frühes `return`; RT-46), Klassen in beliebiger Reihenfolge, auch gegenseitig (Deklaration aller Klassen vor der Analyse, siehe [unten](#klassen-in-beliebiger-reihenfolge)), Top-Level-Funktionen und -Properties vor ihrer Stelle (Analyse bei Bedarf, siehe [unten](#top-level-deklarationen-in-beliebiger-reihenfolge)), `StackOverflowError` (und `Error`) statt Absturz bei zu tiefer Rekursion; Warnung für Accessoren, die ihre eigene Property statt `field` benutzen; `private` Funktionen und Properties (inkl. `private set`), Backing-Feld `field` in eigenen Accessoren, geerbte Methoden über implizites `this`, `inline`/`reified`/`noinline`/`crossinline` mit nichtlokalen Returns, Kovarianz von `List`/`Collection`/`Iterable`, Imports (`ScriptNode.imports`), Standardausnahmen (auch aus nativen Funktionen nach Klasse fangbar), `ArithmeticException` bei Ganzzahldivision durch 0, `InterpreterStateException` für Interpreterfehler und Grenzen wie `readln()` in `toString()` (von keinem `catch` gefangen), `Float` als `Double` (auch `1.5f`), Typinferenz aus deklariertem Property-Typ, Compilefehler für Properties ohne Wert, sekundäre Konstruktoren (RT-48; benannte/default Argumente, suspendierender Rumpf), auch neben dem Primärkonstruktor mit `: this(…)`-Delegation und Kotlins Prüfungen auf fehlende Delegation, Zyklen und gleiche Signaturen (RT-83); bei Überladungen gewinnt wie in Kotlin der Kandidat ohne Standardwerte; eigene Meldung für `: super(…)`, `;` nach Membern, `when` ohne `else` als Anweisung oder bei vollständig abgedeckten Enum-/Boolean-Werten (RT-56), `break`/`continue` in `for`-Schleifen (RT-55), Überschreibungen ohne Rückgabetyp wie `override fun toString() = "…"` (übernehmen den überschriebenen Typ, RT-57), Erweiterungsfunktionen und Obertyp-Erweiterungs-Properties über den impliziten Empfänger (`liste.apply { add(1) }`, RT-63), `data class` (der Parser erzeugt `toString`, `equals`/`hashCode`, `componentN` und `copy` als Kotlin-Quelltext, RT-64), Destrukturierung in Deklarationen, `for`-Schleifen und Lambda-Parametern (vom Parser in `componentN()`-Aufrufe umgeschrieben, RT-65), `vararg` in Erweiterungsfunktionen mit beliebig vielen Argumenten (RT-66), `object` und `companion object` mit genau einer, bei erster Verwendung erzeugten Instanz sowie `const val` (siehe [unten](#objekte-und-companion-objekte), RT-67), Methoden ohne Rückgabetyp vor ihrer Deklaration (Analyse bei Bedarf, RT-68), Methodenaufrufe ohne `this.` in Lambdas, die eine Bibliotheksfunktion ausführt (`map { f() }`, Aufruf über `this/<Klasse>`, RT-69), verschachtelte Klassen (der Parser deklariert `Liste.Knoten` auf oberster Ebene und schreibt `Knoten` in `Liste` um, RT-91) und innere Klassen (versteckte erste Konstruktor-Property `this/<Außen>`, Mitglieder des äußeren Objekts über `this/<Außen>`, RT-92) |
| Ausgabe und Meldungen | Kotlin-Formate (`6.0`, `1.2345678E7`, `1.0E-4` wie auf der JVM, RT-60; `[1, 2]`, `(1, a)`, Map-Einträge als `a=1`, Exceptions als `MyEx: x`), Argumenttypen in „No matching function“ |
| Exceptions | `throw` gibt das geworfene Objekt selbst an `catch` weiter (auch Felder eigener Exception-Klassen); `message`/`cause` funktionieren auch außerhalb von `catch`; Exception-Objekte nutzen die registrierte Klassendefinition (`toString()`, Unterklassen als `cause`) (RT-54) |
| Gleichheit | `List`, `Set`, `Map`, Map-Einträge und `Pair` vergleichen und hashen nach Inhalt wie in Kotlin (`listOf(1) == listOf(1)`, Pairs als Map-Schlüssel); andere Bibliothekswerte nach Identität (RT-52); `super.equals()`/`hashCode()`/`toString()` bis `Any` arbeiten mit dem ganzen Objekt statt mit seinem `Any`-Teil (`ClassInstance.wholeInstance`, RT-53) |
| Bibliothek | `GenericCollectionsModule` (`filterIsInstance`), gemeinsame Laufzeit-Typprüfung `acceptsRuntimeType`, `StdlibInlineMetadata` |
| Performance | Symboltabellen legen Maps erst beim Schreiben an, suchen in Schleifen statt rekursiv und sind kleine lineare Tabellen (`SymbolMap`, große mit JavaScript-`Map` als Index); eine Receiver-Bindung je Methodenaufruf; schlanke Aufrufe nativer Funktionen; Member-Zugriffe und Schleifen-Iteratoren je Klasse am AST-Knoten gemerkt; Blöcke ohne Deklarationen ohne Scope; Typ-Caches pro Klassendefinition bzw. Interpreter, Typprüfungen ohne Allokation; `ClassMemberResolver` merkt sich Signaturen (siehe [blueplay.md](blueplay.md#performance) und `PATCH.md`) |

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

### Klassen in beliebiger Reihenfolge

Wie in Kotlin dürfen Klassen einander in beliebiger Reihenfolge und auch
gegenseitig verwenden (RT-40): `class Hund { var herrchen: Mensch? = null }`
und `class Mensch { val hunde = mutableListOf<Hund>() }` in zwei Dateien,
ebenso Parameter-, Rückgabe- und Konstruktorparametertypen,
Konstruktoraufrufe und Methodenaufrufe in beide Richtungen, Oberklassen und
Interfaces, die erst später im Projekt stehen. Upstream analysiert die
Deklarationen dagegen strikt nacheinander.

- **Deklaration vorab:** Bevor der `SemanticAnalyzer` eine Deklaration
  analysiert, legt er für jede Klasse des Skripts ihre `ClassDefinition` mit
  Oberklasse und Interfaces an (`declareClassesAhead`). Typnamen sind damit
  überall auflösbar. Die spätere Analyse der Klasse vervollständigt genau
  dieses Objekt; bereits aufgelöste Typen bleiben gültig, denn Kotlite
  vergleicht Klassentypen über die Identität ihrer Definition. Die
  Deklaration verbraucht keine Symbolnummern; das hält die Namen früherer
  Deklarationen stabil, auf die sich die dauerhafte Sitzung verlässt.
- **Analyse bei Bedarf:** Eine Klasse wird an ihrer Stelle analysiert oder
  früher, sobald anderer Code zum ersten Mal ihre Member braucht, immer nach
  ihren Oberklassen. Der unterbrochene Code erhält danach seinen
  Analysezustand zurück. Ein Konstruktoraufruf braucht nur die deklarierten
  Parametertypen.
- **Auswertungsreihenfolge:** `ReplAnalyzer` liefert die Klassen zuerst
  (Oberklassen vor Unterklassen), dann die Top-Level-Funktionen (RT-45),
  danach alle übrigen Knoten in Quelltextreihenfolge. `KotliteSession` wertet
  die neuen Knoten in dieser Reihenfolge aus; jede Klasse ist deklariert,
  bevor anderer Code läuft. Zur Laufzeit löst eine Klasse die Typen ihrer
  Properties erst bei der ersten Verwendung auf, weil ihre Property-Typen
  später deklarierte Klassen nennen können. Ausnahme: Die Einträge eines
  Enums entstehen, wenn es deklariert wird. Ein Enum, dessen Einträge andere Argumente als Literale haben
  (`EINS(basis)`), bleibt deshalb an seiner Stelle und kann vorher
  deklarierte Top-Level-Properties lesen.
- **Methoden ohne Rückgabetyp:** Eine Methode mit Ausdruckskörper ohne
  deklarierten Rückgabetyp (`fun bellen() = "Wuff"`) bekommt ihren Typ erst
  durch die Analyse ihres Rumpfs. Braucht anderer Code ihn früher (eine Methode
  weiter oben, ein Property-Initialisierer, eine andere Klasse oder das
  Companion), analysiert der Analyzer sie sofort in ihrem Klassen-Scope
  (`FunctionDeclarationNode.returnTypeInference`, gesetzt nach
  `attachToSemanticAnalyzer`; über `analyzeAtTopLevel`, RT-68); die
  Schleife über die Methoden überspringt sie dann. Hängt ihr Typ von ihr
  selbst ab (`fun a() = b(); fun b() = a()`), braucht sie wie in Kotlin einen
  Rückgabetyp („… because it depends on itself“). Ein Fehler in ihrem Rumpf
  wird auch dann gemeldet, wenn der Code, der sie brauchte, Fehler abfängt.
- **Grenzen:** Solange die Analyse einer Klasse läuft, kennt anderer Code von
  ihren Properties nur die bis dahin analysierten. Ein
  Zyklus in der Vererbung ist ein Compilefehler („There is a cycle in the
  inheritance hierarchy …“). Analysen bei Bedarf verschachteln sich: Braucht
  jede Klasse die Member der nächsten und stehen sie in umgekehrter
  Reihenfolge, wächst die Tiefe mit jeder Klasse. Im Chromium-Worker
  compiliert eine solche Kette aus 50 Klassen, bei 60 läuft der Stack über
  (gemeldet als `StackOverflowError`); das gilt ebenso für Top-Level-
  Funktionen und -Properties, die einander bei Bedarf analysieren (siehe
  [nächster Abschnitt](#top-level-deklarationen-in-beliebiger-reihenfolge)).

### Objekte und Companion-Objekte

`object Name { … }` und `companion object { … }` (RT-67) sind Klassen mit
`ClassDeclarationNode.isObject`; der Parser hängt das Companion als
`companionObject` an seine Klasse und nennt es `<Klasse>.Companion`, wie die
schon vorher vorhandene implizite Companion-Klasse (für `valueOf`, `entries`
und Erweiterungen wie `fun Karte.Companion.f()`). Ein `object` hat kein
Companion.

- **Eine Instanz:** Der Name eines Objekts ist dessen Instanz. Der Analyzer
  setzt `transformedRefName` auf `object/<Klasse>` (`OBJECT_REF_PREFIX`); der
  Interpreter löst solche Namen über `ClassDefinition.objectInstance` auf und
  erzeugt die Instanz wie Kotlin bei der ersten Verwendung
  (`evalCreateClassInstance`, also mit `enterCall`/`leaveCall`).
  `objectInstance` ist gesetzt, sobald die Instanz entsteht: Ihre eigene
  Initialisierung sieht sie bereits (`object O { val a = 1; val b = O.a }`).
  Wirft die Initialisierung, gilt das Objekt als nicht erzeugt und der nächste
  Zugriff versucht es erneut (Kotlin/JVM: `ExceptionInInitializerError`).
  `Name()` ist ein Compilefehler. Ohne eigenes `toString()` zeigt BlueK
  `Hund` bzw. `Karte.Companion`, analog zu `Katze()` für Klasseninstanzen
  (Kotlin: `Hund@1b6d3586`).
- **Companion-Mitglieder ohne Klassennamen:** `declareClassesAhead` legt für
  eine Klasse mit Companion einen eigenen Scope um ihre Klassen-Scopes an; in
  einer Unterklasse liegen die Companion-Scopes ihrer Oberklassen außen
  herum. Gesucht wird also wie in Kotlin erst lokal und in der Klasse, dann im
  eigenen Companion, dann in denen der Oberklassen und zuletzt auf oberster
  Ebene. Der Scope ist anfangs leer; fragt Code der Klasse nach einem Namen,
  den das Companion deklariert (`beforeFunctionLookup`/
  `beforePropertyLookup`), analysiert der Analyzer das Companion und trägt
  dessen Member mit dem Eigentümer `object/<Klasse>.Companion` ein
  (`SymbolTable.declareObjectMembersFrom`). Lesen, Schreiben und Aufrufe laufen
  dann über denselben `ownerRef`-Weg wie `this`-Member. Klasse und Companion
  sehen gegenseitig ihre `private` Member.
- **Reihenfolge:** Braucht nichts in der Klasse das Companion, wird es nach
  ihr analysiert; ein qualifizierter Zugriff vorher (`Karte.zufall()` in einem
  früheren `main()`) analysiert zuerst die Klasse. Braucht die Klasse ihr
  Companion schon während ihrer eigenen Analyse, sieht das Companion von ihr
  nur, was bis dahin analysiert ist: In Default-Argumenten des Konstruktors
  (`class Konto(val stand: Int = START)`) die Konstruktor-Properties (sie
  werden dafür vorab mit ihrem deklarierten Typ eingetragen), in `init` und
  Property-Initialisierern zusätzlich die Methoden und die Properties
  darüber; Methoden ohne Rückgabetyp werden dafür bei Bedarf analysiert
  (RT-68). In Default-Argumenten sind die Methoden noch nicht verfügbar.
- **`const val`:** nur auf oberster Ebene, in Objekten und Companions, nicht
  als `var`, mit Getter oder lokal; Typ ein primitiver Typ oder `String`, Wert
  aus Literalen, Operatoren und anderen `const`-Properties. Ob ein
  qualifizierter Name (`Karte.MAX`) `const` ist, prüft BlueK nicht.
- **Nicht unterstützt** (mit eigener Meldung): benannte Companions
  (`companion object Fabrik`), verschachtelte Objekte und Klassen, Objekte
  innerhalb von Funktionen und Objekt-Ausdrücke (`object : Typ { … }`).
- **GUI:** Das Manifest meldet ein Objekt mit `kind: "object"` ohne
  Konstruktoren und die öffentlichen Companion-Funktionen einer Klasse als
  `companionMethods`. Das Klassenmenü ruft beide als `Name.f(…)` auf.

### Top-Level-Deklarationen in beliebiger Reihenfolge

Top-Level-Funktionen (auch Erweiterungs- und Operatorfunktionen) und
-Properties dürfen wie in Kotlin vor ihrer Stelle verwendet werden (RT-45):
`fun main() { println(hilfe()) }` in `Main.kt` mit `fun hilfe()` in einer
späteren Datei, eine Klasse, die `val maximum` einer späteren Datei liest
oder eine `var` darin ändert, gegenseitig rekursive Funktionen in zwei
Dateien, ein Initialisierer, der eine spätere Funktion aufruft. Überladungen
nach dem Aufruf nehmen an der Auflösung teil.

- **Analyse bei Bedarf statt Vorab-Deklaration:** Der `SemanticAnalyzer`
  analysiert Top-Level-Deklarationen in Quelltextreihenfolge. Schlägt Code
  einen Namen nach, analysiert er vorher alle noch nicht analysierten
  Top-Level-Deklarationen dieses Namens (`analyzeTopLevelAhead`), mit dem
  gesicherten und danach wiederhergestellten Zustand des unterbrochenen Codes
  wie bei Klassen. Auslöser sind Funktionssuchen, die die Skriptebene
  erreichen (`SemanticAnalyzerSymbolTable.beforeFunctionLookup`), und
  Variablenzugriffe, die kein lokaler Name und kein Member verdeckt. Nichts
  wird vorab deklariert und keine Symbolnummer vorab vergeben: Eine
  Deklaration erhält ihren Namen, wenn sie analysiert wird, und alles davor
  behält seine Namen, egal was folgt.
- **Quelltexteinheiten:** Die dauerhafte Sitzung hängt jede Eingabe an den
  Sitzungsquelltext an und analysiert alles neu; die Symbolnummern früherer
  Eingaben müssen dabei gleich bleiben. `KotliteSession` übergibt deshalb den
  Beginn jeder angehängten Quelle (Projekt, BluePlay-Bibliothek,
  Codepad-Eingabe, Objektbank-Bindung) als `unitStarts`. Vor ihrer Stelle
  sichtbar ist eine Deklaration nur in ihrer eigenen Einheit: Eine
  Codepad-Eingabe darf eigene spätere Deklarationen verwenden, aber eine
  spätere Eingabe (etwa eine neue Überladung `fun hilfe(x: Int)`) ändert
  frühere Einheiten nicht, und die Bibliothek sieht keine Projektfunktion mit
  dem Namen einer Funktion, die sie selbst aufruft.
- **Initialisierung in Dateireihenfolge:** Property-Initialisierer laufen
  weiterhin beim Laden in Quelltextreihenfolge; Funktionen werden vorher
  deklariert. Liest ein Initialisierer oder eine Codepad-Anweisung eine
  später initialisierte Property direkt, ist das ein Compilefehler („`b` is
  initialized after this code in file order …“); braucht ein Initialisierer
  seinen eigenen Wert, auch über eine Funktion, meldet die Analyse „`a` is
  used before it is initialized …“. Geschieht der Zugriff erst zur Laufzeit
  über eine Funktion, eine Klasse, ein Lambda oder die Einträge eines Enums,
  wirft der Interpreter eine `InterpreterStateException` („`maximum` is used
  before it is initialized …“), die kein `catch` fängt
  (`VariableReferenceNode.isTopLevelProperty`). Kotlin/JVM initialisiert
  dagegen jede Datei erst bei ihrer ersten Verwendung; dort ergäbe
  `val h = Hund()` in `Main.kt` mit `class Hund { val m = maximum }` und
  `val maximum = 3` in einer späteren Datei `h.m == 3`, in BlueK den
  genannten Fehler. Abhilfe: die Property in eine frühere Datei verschieben.
- **Grenzen:** Eine Funktion mit Ausdruckskörper ohne Rückgabetyp hat keinen
  Typ, solange ihre eigene Analyse läuft. Ruft eine dabei
  analysierte Funktion sie auf (gegenseitige Rekursion wie `fun a() = b()`
  mit `fun b(): Int = a()`), braucht die zuerst analysierte einen
  Rückgabetyp („Cannot infer return type …“); Kotlin verlangt das nur, wenn
  keine der beiden einen hat. Analysen bei Bedarf verschachteln sich wie bei
  Klassen: Ruft jede Funktion die nächste, später stehende auf, compiliert im
  Chromium-Worker eine Kette aus 35 Funktionen, bei 40 läuft der Stack beim
  Compile über (`StackOverflowError`; in Node 100 bzw. 200).

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
  davon ausgenommen); sonst müsste der Stdlib-Aufruf bei jeder Abgabe
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

### Rekursionstiefe und Stack-Überlauf

Jeder interpretierte Aufruf (Funktion, Methode, Accessor, Lambda,
Konstruktor) belegt Dutzende Frames des JavaScript-Stacks. Ohne Gegenmaßnahme
reichte der Stack eines Browser-Workers nur für gut hundert verschachtelte
Aufrufe; danach warf der Browser einen `RangeError`, den BlueK als
„NullPointerException: Kotlite evaluation failed.“ meldete und die Laufzeit
anhielt. Seit RT-42 gilt:

- **Grenze wie in Kotlin:** `Interpreter.enterCall` zählt die Aufruftiefe.
  Ab `maxCallDepth` (1000, wie Pythons Standard) entsteht ein Kotlin-
  `StackOverflowError` mit Stacktrace (die ersten 64 Aufrufe). Er ist ein
  `Error`: `catch (e: Throwable)` und `catch (e: Error)` fangen ihn,
  `catch (e: Exception)` nicht. Ungefangen hält er die Laufzeit an wie jede
  andere ungefangene Ausnahme.
- **Frischer Stack:** Alle 32 Ebenen suspendiert `enterCall` über den
  `stackResetHook` und setzt auf leerem Stack fort (eine Microtask, also ohne
  Timer-Verzögerung). Nur so erreicht die Rekursion die Grenze. Das gilt wie
  bei Checkpoints nicht in synchronen Callbacks (Stdlib-Lambdas, `toString()`
  …) und nicht in den synchronen Session-Methoden.
- **Überlauf des Browsers:** Läuft der Stack dort trotzdem über, ordnet
  `isHostStackOverflow` den `RangeError` als `StackOverflowError` ein, auch
  für `catch`. `fullClassName` benutzt kein `!!` mehr.
- **Warum nur 1000:** Siehe [Technische Schulden](#technische-schulden)
  (Namenssuche über die Aufruferkette). Eine Endlosrekursion bricht so im
  Browser nach unter einer Sekunde ab.

Eigene Accessoren, die statt `field` ihre eigene Property benutzen
(`set(value) { name = value }`, `get() = name`), sind der typische Fall.
Kotlin übersetzt sie, IntelliJ warnt. Der `SemanticAnalyzer` markiert sie an
der `PropertyDeclarationNode`; `KotliteSession` meldet daraus beim Compile
eine Warnung (Diagnose mit `severity: "warning"`, RT-43). Warnungen halten den
Compile nicht auf.

Bei einer nullable Sammlung in einer `for`-Schleife meldet der Analyzer
„Non-nullable value required to call 'iterator()' method in a for-loop.“
am Ausdruck nach `in` (RT-50). Die Prüfung erfolgt erst nach der Auflösung
von `iterator()`, sodass Erweiterungen mit nullable Empfänger gültig bleiben.
BlueK zeigt diese Meldung ohne technischen Exception-Präfix.

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
  Native Ausnahmen bekommen ihren Stacktrace vom ersten Funktionsaufruf, den
  sie durchlaufen (RT-71, siehe unten). (RT-38)
- **Stacktraces:** `CallStack.getStacktrace` liefert die Frames wie Kotlin:
  innen zuerst jede Funktion (`ActivationRecord.frameName`, für Member mit
  deklarierender Klasse, Konstruktoren als `Klasse.<init>`) mit der Position,
  die ihr Code erreicht hat, also die Stelle des Aufrufs in den nächsten Frame
  bzw. die Fehlerstelle. Ein neues Ausnahmeobjekt beginnt dort, wo es erzeugt
  wird; die Konstruktoren, die es erzeugen, sind keine Frames. Native
  Funktionen haben keine Position. Wie Positionen erscheinen, bestimmt der
  Host (`Interpreter.stackFrameFormatter`): BlueK rechnet sie auf Datei und
  Zeile der Projektdatei um, lässt die Codepad-Zeile weg und schreibt
  `(Codepad)`, `(BluePlay)` oder `(Kotlin library)`. Eine Host-Ausnahme
  (`10 / 0`, `"x".toInt()`) sieht interpretierter Code erst im `catch`, wenn
  ihre Frames schon abgebaut sind; der erste Funktionsaufruf, den sie
  durchläuft, merkt sich deshalb den Stack mit der zuletzt begonnenen
  Anweisung als Zeile (`hostExceptionTrace`, `statementPosition`). (RT-71)
- **Vorwärtsverweise zwischen Klassen:** gelöst durch die Deklaration aller
  Klassen vor der Analyse und Analyse bei Bedarf (RT-40, siehe
  [oben](#klassen-in-beliebiger-reihenfolge)); das frühere Umordnen und
  erneute Analysieren nach Fehlermeldungen entfällt. Offen bleibt eine
  vollständige Typinferenz über Klassengrenzen: Wer eine Property einer Klasse
  braucht, deren Analyse gerade läuft, sieht nur deren bis dahin analysierte
  Properties; Methoden ohne Rückgabetyp werden bei Bedarf analysiert (RT-68).
  Top-Level-Funktionen und -Properties werden bei
  Bedarf innerhalb ihrer Quelltexteinheit analysiert (RT-45, siehe
  [oben](#top-level-deklarationen-in-beliebiger-reihenfolge)); ihre
  Initialisierer laufen strikt in Dateireihenfolge.
- **Keine inkrementelle Symboltabelle:** Jede Aktion analysiert den gesamten
  Sitzungsquelltext.
- **Dynamische Scope-Kette:** Der Scope eines Aufrufs hängt am Scope des
  Aufrufers, nicht an dem der Deklaration. Jede Suche nach einem globalen
  Namen (Funktion, Klasse, Typ) läuft deshalb durch alle aufrufenden Ebenen;
  die Laufzeit einer Rekursion wächst quadratisch mit ihrer Tiefe (Chromium-Worker
  mit frischer Sitzung: Tiefe 1000 etwa 0,3 s, Tiefe 4000 etwa 2,7 s). Deshalb liegt `maxCallDepth` bei
  1000. Lexikalische Eltern-Scopes für Funktionsaufrufe würden das beheben,
  ändern aber Kotlites Namensauflösung grundlegend.
- **Fork-Repository veraltet:** siehe oben; entweder den `vendor/`-Stand
  zurück in den Fork übertragen oder den Fork nicht mehr als Quelle nennen.
