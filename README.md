# BlueK

BlueK ist eine lokale Kotlin/JVM-Lernumgebung nach dem Objektbank-Prinzip von BlueJ. Klassen werden als gelbe Karten dargestellt, echte Instanzen liegen als opake Handles in einem langlebigen JVM-Worker, und Methoden- sowie Codepad-Aufrufe werden durch den offiziellen Kotlin-Compiler geprüft.

## Start

Voraussetzungen: Node 22, Java 21 und Kotlin/JVM 2.2.21.

```sh
npm install
npm start
```

`npm start` baut Worker und Frontend vor jedem Start reproduzierbar neu, startet den Server im Vordergrund und kann mit `Ctrl+C` beendet werden. Danach `http://localhost:5173` öffnen. Der vollständige Testlauf ist separat mit `npm run smoke` möglich.

Benutzeraktionen haben standardmäßig ein Zeitlimit von 120 Sekunden. Bei einem Timeout wird der Benutzer-Worker beendet; nach einem erneuten `Compile` wird er automatisch neu erzeugt. Für kurze lokale Tests kann `BLUEK_ACTION_TIMEOUT_MS` gesetzt werden.

Projekt- und Medienimporte werden als eine Compile-Anfrage übertragen (maximal 32 MB JSON). Beim erneuten Compile werden nicht mehr importierte Medien aus der temporären Session entfernt.

Der Server verwendet standardmäßig Port `5173`; für parallele lokale Instanzen kann `BLUEK_PORT=5175 npm start` verwendet werden.

## Bedienung

- `Compile` kompiliert alle Projektdateien gemeinsam und startet eine neue Runtime-Generation.
- `New Class` und `New Functions` legen editierbare Kotlin-Dateien an.
- `Import Kotlin Files` übernimmt vorhandene `.kt`-Dateien, sodass auch ein bestehendes BluePlay-Projekt (z. B. mit `Actor.kt`, `World.kt`, `Image.kt` und `Main.kt`) kompiliert werden kann.
- `Open Project` und `Save Project` lesen beziehungsweise schreiben ein lokales `.bluek.json`-Projekt mit Kotlin-Dateien und eingebetteten Medien. Nach dem Öffnen wird bewusst erst nach `Compile` wieder eine JVM-Session gestartet.
- `Add Media` importiert Bilder und WAV-Dateien in die BluePlay-Pfade `images/` beziehungsweise `sounds/`.
- Doppelklick auf eine Karte öffnet den Quelltexteditor; Änderungen müssen erneut kompiliert werden.
- Rechtsklick auf eine Klasse öffnet den Kotlin-Konstruktor. Strings werden als Kotlin-Ausdrücke mit Anführungszeichen eingegeben.
- Rechtsklick auf ein Objekt zeigt überladene und geerbte öffentliche Methoden. Parameter werden einzeln als Kotlin-Ausdrücke eingegeben.
- Rechtsklick auf eine `«functions»`-Karte zeigt Top-Level-Funktionen; ihre Kotlin-Argumente werden genauso compilergeprüft eingegeben. Ein parameterloses `main()` kann dort wie in BlueJ ausgeführt werden.
- Abstrakte Klassen öffnen keinen Konstruktor-Dialog; Kotlin-`object`-Singletons zeigen stattdessen ihre Methoden für Aufrufe wie `Tools.twice(7)`.
- `Evaluate` wertet einen Ausdruck aus, `Run` einen Block. Bench-Objekte und ihre Mutationen bleiben zwischen Eingaben erhalten; im Codepad deklarierte Variablen (z. B. `val p = Person("Ada")`, auch nullable) können in späteren Eingaben wiederverwendet werden.
- Die Konsole zeigt Rückgabewerte und `stdout` live. Eine eingegebene Zeile wird mit Enter an `readln()` weitergegeben; Prompts erscheinen bereits während der laufenden Eingabeaktion.
- `Stop` beendet den gesamten Benutzer-Worker. Die Handles werden verworfen und nach einem erneuten Compile neu erzeugt.
- Nicht ausführbare Aktionen sind bis zur erfolgreichen Kompilierung deaktiviert. Fällt der Worker aus, werden Runtime, Stage und Bench verworfen und der Fehler im Status/Log angezeigt.

## BluePlay

Enthält ein Projekt eine `BluePlayFunctions.kt`, kompiliert der lokale Adapter diese interne Steuerdatei headless. Das funktioniert auch bei einer gemeinsamen Kotlin-Package-Deklaration; die öffentliche BluePlay-API von `World`, `Actor` und `Image` bleibt verwendbar. `show()` setzt die aktuelle World, `step()` und `start()` führen die Simulation aus. Ein parameterloses `main()` kann den typischen BluePlay-Einstieg ausführen; `Reset` leert dafür die Runtime vollständig und startet `main()` in einer frischen Spielrunde. World-/Actor-Zustände werden als begrenzte Snapshots an die Weboberfläche übertragen und dort als Spielfeld dargestellt. Importierte Actor- und Hintergrundbilder werden als PNG-Daten gerendert; fehlende Bilddateien erscheinen als Platzhalter. Maus-/Tastaturereignisse verwenden dieselbe Actor-Hitbox-Regel wie BluePlay; `isClicked` und `World.isClicked` sind damit nutzbar. Die Stage bietet `Act`, `Run`, `Pause`, `Reset` (bei vorhandenem `main()`) und einen Geschwindigkeitsregler für `setSpeed(1..100)`. `playSound(...)` wird als Ereignis übertragen und aus importierten WAV-Dateien im Browser abgespielt; der Browser kann die Wiedergabe bei fehlender vorheriger Benutzerinteraktion blockieren.

## Architektur

- `frontend`: React/TypeScript/Vite, ausschließlich gegen serialisierbare Daten; `HttpRuntimeClient` kapselt den aktuellen HTTP-Transport und implementiert den austauschbaren Runtime-Vertrag.
- `runtime-contract`: RuntimeClient- und Werttypen.
- `server`: Sitzungen, temporäre Projektverzeichnisse, Kotlin-Kompilierung, request-id-basierte Worker-Antwortverteilung und Generationenprüfung.
- `jvm`: langlebiger Worker mit Objektregistry, Kotlin-Snippet-Kompilierung, stdin-Kontrollpfad, Stop-Semantik und BluePlay-Stage-Snapshot.
- `examples`: editierbare Startdateien (`Counter.kt`, `Person.kt`, `Helpers.kt`).

Benutzercode läuft nie im HTTP-Prozess. Ein eigener Prozess ist jedoch keine Sandbox; öffentliche oder nicht vertrauenswürdige Ausführung benötigt zusätzliche OS-/Container-Isolation und Ressourcenlimits.

## Nachgewiesene Proben

Mit echten `kotlinc`- und Worker-Prozessen geprüft:

- `Person("Ada")`, `greet()`, `rename("Bea")`, `greetInConsole()` und korrekte `Unit`-/stdout-Darstellung.
- `Counter()` mit ausgelassenem Default-Argument und unabhängige Objektidentität.
- Überladungen `choose(Int)`/`choose(String)`.
- `Box<String>`: `replace(42)` wird vom Kotlin-Compiler abgelehnt, der ursprüngliche String bleibt erhalten.
- `Animal`/`Dog`: dynamischer Dispatch, geerbte Methode einmalig im Menü, Interface ohne Konstruktoraktion.
- BluePlay `MyWorld` mit Actor-Snapshot und Mutation per `show(); step()`.
- Die realen BluePlay-Referenzdateien (`Actor.kt`, `World.kt`, `Image.kt`, `Figure.kt`, `MyWorld.kt` und `Main.kt`) kompilieren; `MyWorld()` und `show()` liefern einen fehlerfreien 600×400-Stage-Snapshot.
- BluePlay-Actor- und World-Klicks einschließlich Hitbox und Geschwindigkeitsgrenzen.
- stale `generationId` wird per HTTP mit `409` abgewiesen.
- Browser-Session-Cleanup entfernt Worker und temporäre Verzeichnisse beim Verlassen der Seite; zusätzlich werden inaktive Sessions nach 30 Minuten automatisch aufgeräumt.

## Bewusste Grenzen

Die Metadatenanzeige ist noch keine vollständige Kotlin-PSI-/`kotlin-reflect`-Analyse; komplexe Sprachkonstrukte können daher im Menü fehlen, bleiben aber über Compile/Codepad dem Kotlin-Compiler überlassen. TypeRefs bewahren bereits verschachtelte Generics, Nullbarkeit und `in`/`out`/`*`-Projektionen. Persistente Codepad-Deklarationen, selbst gezeichnete Bildänderungen und ein öffentlicher Mehrbenutzerbetrieb sind nicht Teil des aktuellen lokalen Adapters.
