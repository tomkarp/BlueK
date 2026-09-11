# BlueK

BlueK ist eine browserbasierte Kotlin-Lernumgebung nach dem Objektbank-Prinzip von BlueJ. Klassen werden als gelbe Karten dargestellt, echte Instanzen liegen als opake Handles in einem langlebigen Browser-Worker, und Methoden-, Codepad- sowie BluePlay-Aufrufe laufen lokal in Kotlin/JS. BluePlay-Welten werden im selben Worker auf ein OffscreenCanvas gezeichnet; der Server kompiliert und analysiert den Projektcode.

## Start

Voraussetzungen: Node 22 und Java 21 für die serverseitige Kotlin/JS-Kompilierung. Der mitgelieferte Gradle-Wrapper pinnt die Kotlin-/Browser-Toolchain; die npm-Abhängigkeiten sind ebenfalls versionsgenau gepinnt.

```sh
npm install
npm start
```

`npm start` baut Compileradapter und Frontend vor jedem Start reproduzierbar neu, startet den Server im Vordergrund und kann mit `Ctrl+C` beendet werden. Danach `http://localhost:5173` öffnen. Der Server kompiliert Kotlin/JS-Module; ausführbarer Schülercode läuft ausschließlich im Browser-Worker.

Browser-Ausführungen laufen in einem eigenen Worker. Bei `Stop` wird dieser Worker beendet; nach einem erneuten `Compile` entsteht eine neue Generation. Es gibt keinen JVM-Ausführungsfallback.

Projekt- und Medienimporte werden als eine Compile-Anfrage übertragen (maximal 32 MB JSON). Beim erneuten Compile werden nicht mehr importierte Medien aus der temporären Session entfernt.

Der Server verwendet standardmäßig Port `5173`; für parallele lokale Instanzen kann `BLUEK_PORT=5175 npm start` verwendet werden.

## Bedienung

- `Compile` kompiliert alle Projektdateien gemeinsam und startet eine neue Runtime-Generation.
- `New Class` und `New Functions` legen editierbare Kotlin-Dateien an.
- `Import Kotlin Files` übernimmt vorhandene `.kt`-Dateien, sodass auch ein bestehendes BluePlay-Projekt (z. B. mit `Actor.kt`, `World.kt`, `Image.kt` und `Main.kt`) kompiliert werden kann.
- `Open Project` und `Save Project` lesen beziehungsweise schreiben ein lokales `.bluek.json`-Projekt mit Kotlin-Dateien und eingebetteten Medien. Nach dem Öffnen wird bewusst erst nach `Compile` wieder eine Browser-Runtime gestartet.
- `Add Media` importiert Bilder und WAV-Dateien in die BluePlay-Pfade `images/` beziehungsweise `sounds/`.
- Doppelklick auf eine Karte öffnet den Quelltexteditor; Änderungen müssen erneut kompiliert werden.
- Klassen- und Funktionskarten lassen sich im BlueJ-Arbeitsbereich per Drag-and-drop frei anordnen; die Positionen werden im `.bluek.json`-Projekt gespeichert.
- Rechtsklick auf eine Klasse öffnet den Kotlin-Konstruktor. Strings werden als Kotlin-Ausdrücke mit Anführungszeichen eingegeben.
- Rechtsklick auf ein Objekt zeigt überladene und geerbte öffentliche Methoden. Parameter werden einzeln als Kotlin-Ausdrücke eingegeben.
- Rechtsklick auf eine `«functions»`-Karte zeigt Top-Level-Funktionen; ihre Kotlin-Argumente werden genauso compilergeprüft eingegeben. Ein parameterloses `main()` wird dort wie in BlueJ aufgerufen. Mehrere Funktionsdateien mit `main()` werden nicht stillschweigend ausgewählt; `Reset` startet gezielt `Main.kt`.
- Abstrakte Klassen öffnen keinen Konstruktor-Dialog; Kotlin-`object`-Singletons zeigen stattdessen ihre Methoden für Aufrufe wie `Tools.twice(7)`.
- Das Codepad arbeitet wie in BlueJ mit einer einzelnen Eingabezeile: Enter wertet den Ausdruck beziehungsweise die Anweisung sofort aus; der Verlauf bleibt darüber sichtbar und Pfeil hoch/runter holt frühere Eingaben zurück. Ausdrücke und Rückgabewerte werden im Codepad angezeigt, `Unit` bleibt unsichtbar; Konsolenausgaben erscheinen im Terminal. Bench-Objekte und ihre Mutationen bleiben zwischen Eingaben erhalten; im Codepad deklarierte Variablen (z. B. `val p = Person("Ada")`, auch nullable) können in späteren Eingaben wiederverwendet werden.
- Die Konsole zeigt Rückgabewerte und `stdout` live. Eine eingegebene Zeile wird mit Enter an `readln()`, `readlnOrNull()` oder das kompatible `readLine()` weitergegeben; Prompts erscheinen bereits während der laufenden Eingabeaktion.
- `Stop` beendet den gesamten Browser-Worker. Die Handles werden verworfen und nach einem erneuten Compile neu erzeugt.
- Nicht ausführbare Aktionen sind bis zur erfolgreichen Kompilierung deaktiviert. Fällt der Worker aus, werden Runtime, Stage und Bench verworfen und der Fehler im Status/Log angezeigt.

## BluePlay

Enthält ein Projekt eine `BluePlayFunctions.kt`, kompiliert der lokale Adapter diese interne Steuerdatei headless. Das funktioniert auch bei einer gemeinsamen Kotlin-Package-Deklaration; die öffentliche BluePlay-API von `World`, `Actor` und `Image` bleibt verwendbar. `show()` setzt die aktuelle World, `step()` und `start()` führen die Simulation aus. Ein parameterloses `main()` kann den typischen BluePlay-Einstieg ausführen; `Reset` leert dafür die Runtime vollständig und startet `main()` in einer frischen Spielrunde. World-/Actor-Zustände werden als begrenzte Snapshots an die Weboberfläche übertragen und dort als Spielfeld dargestellt. Importierte Actor- und Hintergrundbilder werden als PNG-Daten gerendert; fehlende Bilddateien erscheinen als Platzhalter. Maus-/Tastaturereignisse verwenden dieselbe Actor-Hitbox-Regel wie BluePlay; `isClicked` und `World.isClicked` sind damit nutzbar. Die Stage bietet `Act`, `Run`, `Pause`, `Reset` (bei vorhandenem `main()`) und einen Geschwindigkeitsregler für `setSpeed(1..100)`. `playSound(...)` wird als Ereignis übertragen und aus importierten WAV-Dateien im Browser abgespielt; der Browser kann die Wiedergabe bei fehlender vorheriger Benutzerinteraktion blockieren.

## Architektur

- `frontend`: React/TypeScript/Vite, ausschließlich gegen serialisierbare Daten; `HttpRuntimeClient` kapselt den aktuellen HTTP-Transport und implementiert den austauschbaren Runtime-Vertrag.
- `runtime-contract`: RuntimeClient- und Werttypen.
- `server`: Sitzungen, temporäre Projektverzeichnisse, Kotlin-Kompilierung, request-id-basierte Worker-Antwortverteilung und Generationenprüfung.
- `jvm`: Gradle-Wrapper für die Kotlin/JS-Kompilierung; enthält keinen BlueK-Ausführungsworker.
- `examples`: editierbare Startprojekte. BlueK lädt standardmäßig das kleine BluePlay-Projekt aus `examples/blueplay`; das ursprüngliche Counter/Person-Beispiel bleibt über `/api/examples/basic` verfügbar. Das vollständige KrokoAlarm-Beispiel aus dem BlueJ-Projekt ist über `/api/examples/krokoalarm` als Browser-Testprobe verfügbar.

Benutzercode läuft nie im HTTP-Prozess. Die normale Ausführung läuft im Browser-Worker. Ein Browser-Worker ist jedoch keine Sandbox für untrusted Code; öffentliche oder nicht vertrauenswürdige Ausführung benötigt zusätzliche Browser-/Server-Sicherheitsmaßnahmen und Ressourcenlimits.

## Nachgewiesene Proben

Mit echten `kotlinc`- und Worker-Prozessen geprüft:

- `Person("Ada")`, `greet()`, `rename("Bea")`, `greetInConsole()` und korrekte `Unit`-/stdout-Darstellung.
- Bench-Objekte können in Konstruktor-Dialogen als Kotlin-Argumente verwendet werden; `CounterUser(counter1)` erhält dieselbe Objektidentität und mutiert den vorhandenen Counter.
- Eine frei definierte `Rectangle`-Klasse erscheint ohne BlueK-Anpassung, lässt sich erzeugen und liefert `area()` korrekt.
- `Counter()` mit ausgelassenem Default-Argument und unabhängige Objektidentität.
- Überladungen `choose(Int)`/`choose(String)`.
- `Box<String>`: `replace(42)` wird vom Kotlin-Compiler abgelehnt, der ursprüngliche String bleibt erhalten.
- Generische Methoden bewahren ihre Typparameter; Aufrufe wie `getObjects<Ball>()` und `getOneIntersecting<Muenze>()` können über den Dialog mit expliziten Kotlin-Typen ausgeführt werden.
- `Animal`/`Dog`: dynamischer Dispatch, geerbte Methode einmalig im Menü, Interface ohne Konstruktoraktion.
- Geerbte Kotlin-Properties liefern im Unterklassenmenü ebenfalls nutzbare Getter-/Setter-Aktionen.
- Kotlin-`Any`-Methoden (`toString`, `hashCode`, `equals`) erscheinen bei Klassen als geerbte, ausführbare Objektaktionen.
- Interfaces bleiben nicht instanziierbar; eine konkrete Implementierung wird kompiliert, erzeugt und über ihre echte Implementierung aufgerufen.
- `Inspect` liest nur Instanzfelder und löst berechnete Getter nicht automatisch aus; solche Properties werden erst durch einen expliziten Kotlin-Aufruf ausgewertet.
- BluePlay `MyWorld` mit Actor-Snapshot und Mutation per `show(); step()`.
- Die realen BluePlay-Referenzdateien (`Actor.kt`, `World.kt`, `Image.kt`, `Figure.kt`, `MyWorld.kt` und `Main.kt`) kompilieren; `MyWorld()` und `show()` liefern einen fehlerfreien 600×400-Stage-Snapshot.
- BluePlay-Actor- und World-Klicks einschließlich Hitbox und Geschwindigkeitsgrenzen.
- BluePlay-Properties mit benutzerdefiniertem Getter, etwa `isClicked`, werden Kotlin-konform als Boolean-Aktion angezeigt.
- stale `generationId` wird per HTTP mit `409` abgewiesen.
- Zwei parallele Sitzungen behalten getrennte Worker, Objekt-Benches und Konsolenereignisse.
- Browser-Session-Cleanup entfernt Worker und temporäre Verzeichnisse beim Verlassen der Seite; zusätzlich werden inaktive Sessions nach 30 Minuten automatisch aufgeräumt.

## Bewusste Grenzen

Die Metadatenanzeige ist noch keine vollständige Kotlin-PSI-/`kotlin-reflect`-Analyse; komplexe Sprachkonstrukte können daher im Menü fehlen, bleiben aber über Compile/Codepad dem Kotlin-Compiler überlassen. TypeRefs bewahren bereits verschachtelte Generics, Nullbarkeit und `in`/`out`/`*`-Projektionen. Selbst gezeichnete Bildänderungen und ein öffentlicher Mehrbenutzerbetrieb sind nicht Teil des aktuellen lokalen Adapters.
