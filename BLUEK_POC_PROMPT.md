# Umsetzungsprompt: BlueK mit austauschbarer Ausführungsumgebung

Implementiere in diesem Projekt eine lokal startbare Web-App **BlueK**, eine stark an BlueJ angelehnte Lernumgebung ausschließlich für Kotlin. Liefere einen tatsächlich funktionierenden Proof of Concept. Lies zuerst `BLUEJ_ARCHITECTURE_ANALYSIS.md` im Projekt: Die dort dokumentierten Mechanismen sind die Grundlage dieses Plans. Analysiere BlueJ nicht erneut vollständig und kopiere keinen BlueJ-Implementierungscode.

## Ziel und feste Architekturentscheidungen

BlueK zeigt Klassen und Funktionsdateien, erzeugt echte Objekte über Kontextmenüs, erlaubt Methodenaufrufe und Inspektion und führt Kotlin-Direkteingaben auf denselben Objekten aus. Es hat eine Konsole mit echter interaktiver Eingabe.

Zunächst läuft der offizielle Kotlin/JVM-Compiler auf einem lokalen Server. Gestalte die gesamte Ausführungsumgebung austauschbar, sodass später ein Browseradapter ergänzt werden kann. Implementiere jetzt ausschließlich den JVM-Adapter. Keine Browser-JVM, kein MiniKotlin, kein selbst entwickelter Interpreter, kein großes Plugin-System. Der Austausch betrifft auch Objekte und Codepad, nicht nur die Compilerfunktion.

Die Beispieldateien sind Startinhalte, keine fest verdrahteten Sonderfälle. Benutzer müssen Quelltext ändern und weitere Klassen schreiben können, ohne den BlueK-Code anzupassen. Keine Metadatenmanifeste für konkrete Beispielklassen, keine Regex-Sprachimplementierung, keine simulierte Ausführung.

Langfristiges Ziel ist reguläres Kotlin einschließlich Vererbung, Interfaces, Generics, Überladung und Null-Sicherheit. Der PoC darf Dialogfunktionen begrenzen, aber Kotlin-Sprachsemantik nicht durch vereinfachte eigene Regeln ersetzen. Geerbte Methoden, einfache generische Klassen und Überladung müssen bereits durch Architekturproben abgedeckt werden.

## Stack und Module

Verwende React, TypeScript und Vite für die Oberfläche, einen kleinen Node.js/TypeScript-Server für HTTP/WebSocket und Prozesssteuerung sowie Kotlin/JVM für Analysehilfen und Worker. Nutze Gradle für JVM-Module und den offiziellen Kotlin-Compiler für Benutzerprojekt und Snippets. Pinne eine verfügbare, zueinander passende Kotlin-/JDK-/Gradle-Kombination; dokumentiere die tatsächlich getesteten Versionen. Eigene JVM-Pakete beginnen mit `de.tomkarp.bluek`.

Trenne mindestens:

- `frontend`: UI und RuntimeClient-Verwendung, keine JVM-Annahmen.
- `runtime-contract`: serialisierbare Requests, Ergebnisse, Metadaten, Fehler und Ereignisse.
- `server`: Sitzungen, Transport und JVM-Adapter.
- `jvm`: Analyse, gemeinsame Worker-API und Worker.
- `examples`: initiale `.kt`-Dateien.

Dateien existieren als logisches Projektmodell mit je einer Source-Datei. Für Kompilierung schreibt der Server diese in ein temporäres Arbeitsverzeichnis. Kein Speichern/Laden von Benutzerprojekten, keine Datenbank, kein Login, kein Git, kein Testwerkzeug in der UI. Oberfläche nur Englisch. Technische Tests sind erforderlich.

## RuntimeClient-Vertrag

Alle Operationen sind asynchron. Die Oberfläche verwendet eine konkrete TypeScript-Schnittstelle, deren JVM-Implementierung HTTP/WebSocket kapselt. Ein künftiger Browseradapter könnte denselben Vertrag über Worker-Nachrichten erfüllen.

| Operation | Bedeutung |
|---|---|
| `compile(files, revision)` | Komplettes Projekt validieren/kompilieren; neue Generation und Metadaten liefern |
| `createObject(classId, constructorId, typeArguments, arguments, name)` | Instanz erzeugen und als Bench-Bindung registrieren |
| `invokeMethod(objectId, callableId, typeArguments, arguments)` | Gewählte Methode aufrufen |
| `inspectObject(objectId)` | Begrenzte Darstellung gespeicherter Felder und Referenzen |
| `evaluate(code, mode)` | Ausdruck oder Anweisungsblock auf vorhandenen Bench-Bindungen ausführen |
| `removeObject(objectId)` | Bench-Bindung entfernen |
| `sendInput(text)` | Konsolenzeile an laufendes Benutzerprogramm senden |
| `stop()` / `reset()` | Abbrechen beziehungsweise Sitzung neu initialisieren |

Ergänze Sitzungsanlage/-ende und gegebenenfalls Methodenauflistung für einen konkreten generischen Empfängertyp. Parameterdialoge akzeptieren Kotlin-Ausdrücke, sodass auch Bench-Objekte, `null`, Listen und berechnete Werte als Argumente möglich sind. Textfelder deutlich als Kotlin-Ausdrücke kennzeichnen; Strings brauchen Anführungszeichen. Standardargumente können explizit ausgelassen werden. Benutzercode niemals in Shell-Kommandos interpolieren.

Requests/Ereignisse tragen `sessionId`, `requestId` und, wo relevant, `generationId` sowie `sourceRevision`. Ereignisse umfassen Status, stdout, stderr, Compilerdiagnosen, Ergebnis und Runtime-Reset. Alte Handles und verspätete Antworten dürfen keine neue Generation verändern.

Benötigte Datenformen:

- Datei: ID, Dateiname, Art (`class`/`functions`), Quelltext, Revision.
- Typ: strukturierter TypeRef mit Klassifikator oder scoped Typparameter-ID, Typargumenten, Projektionen und Nullbarkeit; zusätzlich lesbarer Anzeigename. Nicht als JVM-`Class` oder bloßer String übermitteln.
- Klasse: ID, Quellposition, Name, Art, Sichtbarkeit, Typparameter/Bounds, Supertypen, Konstruktoren, Methoden und Properties.
- Callable: generationsgebundene eindeutige ID, Name, deklarierender Typ, Parameter/Defaultflags, Typparameter, Rückgabetyp, Sichtbarkeit und geerbter Ursprung.
- Bench-Bindung: opake ID, gültiger Kotlin-Name, statischer Bindungstyp und gesonderter Laufzeittyp.
- Wert: diskriminierte Varianten für `Unit`, `null`, skalare Darstellung und Objektreferenz. Große Ganzzahlen verlustfrei als Text übertragen. Referenzen nicht rekursiv serialisieren.

Das Frontend zeigt Metadaten an; Überladungsauflösung, Typprüfung und generische Semantik bleiben im JVM-Adapter/Compiler. Fähigkeiten können klein und explizit beschrieben werden, etwa persistente Codepad-Deklarationen aktuell `false`. Der Vertrag verspricht keine automatische Portierung von JVM-Bibliotheken in den Browser.

## Dateiregeln und Oberfläche

BlueJ-artige Desktop-Anmutung: hellgraue Fläche, dünne Rahmen, kompakte Toolbar, gelbliche Klassenkarten und rote Objektkarten. Keine Landingpage. Eigene CSS-Gestaltung ohne übernommene Logos.

```text
+-----------------------------------------------------------+
| BlueK  New Class  New Functions File  Compile  Reset       |
+-----------------------------------------------------------+
|                                                           |
| [ Counter ]       [ Person ]       [ Helpers.kt ]          |
|                                    «functions»            |
|                 Classes and Functions                     |
+-----------------------------+-----------------------------+
| Object Bench                | Code Pad                    |
| [counter1: Counter]         | Kotlin input                |
| [person1: Person]           | Evaluate / Run / Stop       |
|                             | Results and history         |
+-----------------------------------------------------------+
| Console: stdout / stderr                                  |
| Input line                                     Send       |
+-----------------------------------------------------------+
```

- Genau eine Top-Level-Klasse pro Klassendatei, Dateiname entspricht Klassenname. Memberfunktionen sind selbstverständlich erlaubt. Keine Top-Level-Funktionen in dieser Datei.
- Funktionsdateien enthalten Top-Level-Funktionen, keine Klassen oder Top-Level-Properties. Imports und Package-Direktiven zählen nicht als gemischte Deklarationen.
- Für Interface-/abstrakte Deklarationen keine Konstruktoraktion anbieten. Eine Interface-Deklaration darf als Klassendatei im Projektmodell geführt werden. Validierung am Kotlin-Syntaxbaum, nicht mit Regex. Fehlermeldungen nennen die BlueK-Regel, wenn gültiges Kotlin gegen diese Regel verstößt.
- Doppelklick öffnet einen editierbaren Quelltextbereich. Änderungen markieren Projekt/Karte als unkompiliert; Bench-Ausführung ist bis erfolgreicher Kompilierung gesperrt. Keine vollständige IDE/Autocomplete nötig.
- Rechtsklick auf eine Klasse zeigt dynamisch ihre Konstruktoren. Dialog fragt Namen, bei generischen Klassen explizite Typargumente und Argumentausdrücke ab.
- Rechtsklick auf ein Objekt zeigt öffentliche Methoden, geerbte Methoden erkennbar gruppiert, `Inspect` und `Remove`. Überladungen als unterschiedliche Signaturen darstellen. Menü auch über Knopf erreichbar.
- Konsole als eigener einblendbarer Bereich; bei Ausgabe oder Eingabebedarf sichtbar. Compilerfehler mit Dateiname/Zeile/Spalte separat kenntlich machen.
- Busy-, Compile-, Fehler-, Verbindungs- und Reset-Zustände sichtbar. Stop und stdin bleiben während einer Ausführung verfügbar.

## Dynamische Klasseninformationen

Nutze Kotlin-Compiler-Parser/PSI für Dateistruktur und Quellpositionen. Extrahiere nach erfolgreicher Kompilierung Kotlin-spezifische Deklarationsinformationen über Kotlin-Metadaten und/oder `kotlin-reflect`. Java-Reflection allein ist nicht ausreichend. Blende synthetische JVM-Implementierungsdetails wie `$default` und Bridge-Methoden aus.

Kapsle den Analysecode hinter einem JVM-internen Dienst und pinne die Kotlin-Version. Prüfe im ersten Durchstich, welche Kombination zuverlässig Klassen, Top-Level-Funktionen, Parameter, Sichtbarkeit, Properties und generische Supertypen liefert. Verwechsle einen Parser nicht mit einem Typchecker. Verwende Compileranalyse nur dort, wo Metadaten nicht genügen; baue keine eigenen allgemeinen Kotlin-Typregeln.

Beim Methodenmenü für `Box<String>` sollen substitutionsbedingt `String`-Typen sichtbar sein. Explizite Typargumente bei Objekterzeugung sind für den PoC zulässig und müssen mit dem Compiler auf Bounds geprüft werden. Bewahre sie in der Bench-Bindung auf: Sie sind aus der JVM-Laufzeitklasse nicht allgemein rekonstruierbar.

Bei schwierigeren Dialogfällen ist ein klarer Hinweis mit Codepad-Nutzung zulässig. Die unten genannten Architekturproben sind jedoch verbindlich; insbesondere keine Beschränkung auf zwei Klassennamen oder primitive Parameter.

## JVM-Laufzeit nach dem BlueJ-Prinzip

1. Pro Sitzung einen separaten langlebigen Worker für Benutzercode betreiben. Keine Benutzerklassen im HTTP-Prozess ausführen.
2. Projektdateien gemeinsam kompilieren. Klassen derselben Projektgeneration im Worker genau einmal laden.
3. Registry hält echte Objektinstanzen, opake Handles und separat benannte, typisierte Bench-Bindungen. Identität anhand Referenzidentität verwalten, nicht anhand `equals()`.
4. Neue Eingaben als eindeutige Kotlin-Snippet-Klassen gegen Projekt und Worker-API kompilieren. Diese implementieren ein gemeinsames Interface wie `execute(context): Any?`.
5. Bindungen erzeugen, beispielsweise `val box1 = context.getObject(id) as Box<String>`, dann den Benutzeraufruf ausführen. Namen und Typquellen stammen aus validiertem Sitzungszustand. Reservierte interne Namen kollisionsfrei erzeugen.
6. Snippets per Child-Classloader laden; Projektklassen/API stammen aus gemeinsamen Parents. Projektklassen niemals in jedes Snippet-JAR kopieren. Kein Replay früherer Eingaben, kein Rekonstruieren der Objekte aus JSON.
7. Konstruktor- und Methodenaktionen verwenden denselben Kotlin-Aufrufpfad. Ausgewählte Überladung anhand Metadaten/typisierter Argumente oder passender typisierter Callable-Referenz eindeutig binden; keine heimliche Auswahl einer anderen Überladung. Der Compiler prüft Argumentausdrücke. Virtueller Dispatch muss erhalten bleiben.
8. Konstruktorergebnisse als Bench-Bindung registrieren. Primitive Ergebnisse und Strings darstellen, `Unit`/`null` unterscheiden. Beliebige Objektresultate müssen im PoC noch nicht automatisch auf die Bench übernommen werden; Referenzdarstellung darf vorgesehen sein.
9. Nach Aktionen gespeicherte Felder aktualisieren, auch bei Laufzeitfehlern: bereits ausgeführte Änderungen werden nicht zurückgerollt.

Automatische Inspektion liest Felder/Backing Fields, keine beliebigen Getter oder `toString()`-Methoden. Berechnete Properties als solche kennzeichnen und nur auf expliziten Wunsch unter denselben Ausführungs-/Abbruchregeln auswerten. Arrays/Listen zunächst begrenzt oder als Referenz zeigen; keine zyklische Vollserialisierung.

## Codepad und Kompilierungsgenerationen

- `Evaluate`: ein Kotlin-Ausdruck, zum Beispiel `counter1.current()` oder `square(7)`; Ergebnis anzeigen.
- `Run`: mehrzeiliger Kotlin-Block, zum Beispiel `counter1.add(5); println(counter1.current())`; Ergebnis `Unit`.
- Lokale `val`/`var` leben zunächst nur in dieser Eingabe. Bench-Objekte und ihre Mutationen bleiben erhalten. Diese Grenze kurz in der Oberfläche erklären.
- Keine persistente REPL oder Top-Level-Importverwaltung im PoC. Projektdeklarationen über passende generierte Imports nutzbar machen; voll qualifizierte Namen erlauben. Namenskonflikte nicht stillschweigend auflösen.
- Compilerdiagnosen der Snippets auf Benutzerzeilen beziehungsweise Parameterfelder abbilden. Kompilierungsfehler führen zu keiner Ausführung und erhalten den bisherigen Bench-Zustand.
- **Projektkompilierung ist etwas anderes:** Ein explizites `Compile` invalidiert zu Beginn die bisherige Laufzeit und leert Bench sowie Codepad-Zustand. Bei Fehlern bleibt das Projekt nicht ausführbar. Erfolgreiche Kompilierung startet eine neue Generation. Diese einfache Reset-Politik klar kommunizieren.
- Stop, Worker-Absturz oder Timeout setzen die Laufzeit zurück und invalidieren Handles. Projektquellen bleiben im Editor erhalten. Eine neue Worker-Instanz kann mit dem letzten gültigen Projektartefakt starten, sofern die aktuelle Quellrevision dazu passt.

## Konsole und Prozesssteuerung

Separate Steuerverbindung zwischen Server und Worker, zum Beispiel lokaler Socket mit Sitzungstoken. stdout/stderr gehören dem Benutzerprogramm; stdin dient dessen Eingabe. Kein JSON-Steuerprotokoll zwischen Programmausgaben mischen.

Pro Sitzung nur eine laufende Benutzeraktion. Ein separater Kontrollpfad bleibt für Eingabe, Status und Stop ansprechbar. Keine Benutzer-Getter im Kontrollthread ausführen. `readln()` muss tatsächlich auf eine im Browser eingegebene Zeile warten können. UTF-8 und Zeilenumbrüche konsistent behandeln.

Compiler-Timeout und Ausführungs-Timeout getrennt konfigurierbar, zunächst etwa 60 und 120 Sekunden; Eingabewartezeit zählt zur Ausführung. JVM-Heap und Ausgabemenge begrenzen. Stop muss einen gesamten Worker beenden können, auch bei Endlosschleifen. Compilerprozesse ebenfalls abbrechen/aufräumen. Keine reine Thread-Interrupt-Lösung.

Sitzungen, temporäre Artefakte, Sockets und Kindprozesse bei Reset, Idle-Ablauf und Serverende aufräumen. Lokal nur für vertrauenswürdigen eigenen Code betreiben. In README festhalten: Prozesse allein bilden keine Sandbox; öffentlicher Betrieb erfordert isolierte Ausführungsumgebungen. Jetzt keine öffentliche Bereitstellung implementieren.

## Startprojekt

Lege als editierbare Quelldateien an:

```kotlin
// Counter.kt
class Counter(var value: Int = 0) {
    fun increment() { value++ }
    fun add(amount: Int) { value += amount }
    fun current(): Int = value
}
```

```kotlin
// Person.kt
class Person(var name: String) {
    fun greet(): String = "Hello, $name!"
    fun rename(newName: String) { name = newName }
    fun greetInConsole() { println(greet()) }
}
```

```kotlin
// Helpers.kt
fun square(x: Int): Int = x * x
fun askName(): String {
    println("What is your name?")
    val name = readln()
    println("Hello, $name!")
    return name
}
```

## Umsetzung in überprüfbaren Schritten

1. Werkzeuge und Projektanweisungen prüfen. Runtime-Vertrag und einen kleinen echten JVM-Durchstich implementieren: Dateien kompilieren, Metadaten liefern, Objekt dynamisch erzeugen, getrennte Snippets ausführen, Identität/Typ erhalten.
2. Vor dem UI-Ausbau die Architekturproben unten für neue Klassen, Vererbung, Generics und Überladung sowie stdin und Stop ausführen. Keine monatelange Generalisierung; konkretes Verhalten belegen.
3. Sitzungsserver, Generationen und gestreamte Ereignisse vervollständigen.
4. BlueJ-artige Oberfläche, editierbare Dateien, dynamische Dialoge, Bench, Codepad und Konsole verbinden.
5. Integrationstests und Browserprüfung durchführen. Tatsächliche Kompilierungszeiten messen. README und Abschlussbericht schreiben.

Bei fehlenden Werkzeugen genaue Voraussetzungen nennen. Keine Mocks als erfolgreiche Laufzeit ausgeben. Bei einem nicht bestandenen Architekturtest die konkrete Ursache und Grenze dokumentieren, statt das Feature stillschweigend durch eine fest verdrahtete Demo zu ersetzen.

## Verbindliche Abnahme

1. `Counter(3)` per Klassenmenü als `counter1` erzeugen. Menüaufruf `increment()` ergibt `4`. Separate Codepad-Eingaben `counter1.add(5)` und `counter1.current()` ergeben `9`; Inspect ebenfalls `9`.
2. Zweiter Counter bleibt unabhängig. Neue Klasse `CounterUser(val counter: Counter)` in neuer Datei hinzufügen. Eine Methode darin verändert den übergebenen Counter. Nach Projektkompilierung neu erzeugte Bench-Objekte zeigen denselben Zustand: Referenzidentität bleibt über Objektargumente erhalten.
3. Eine frei geschriebene dritte Klasse `Rectangle(val width: Int, val height: Int)` mit `fun area() = width * height` hinzufügen. Ohne BlueK-Codeänderung erscheint Konstruktor/Methodenmenü; Instanz und Flächenaufruf funktionieren. Implementierung von `area` ändern und erneut kompilieren: alte Bench verschwindet, neue Instanz verwendet neue Implementierung.
4. Getrennte Dateien: `open class Animal { open fun sound(): String = "?" }` und `class Dog : Animal() { override fun sound() = "woof" }`. Dog erzeugen; Run `val a: Animal = dog1; println(a.sound())` gibt `woof` aus. Menü zeigt die überschriebene Methode nicht doppelt. Zusätzlich eine tatsächlich nur geerbte Methode prüfen.
5. Getrennte Datei `class Box<T>(var value: T) { fun replace(next: T) { value = next }; fun get(): T = value }`. `Box<String>` erzeugen; Anzeige und Dialogtypen bewahren `String`. Austausch gegen String funktioniert, `box1.replace(42)` wird vor Ausführung abgewiesen. Konstruktorprüfung mit einer zusätzlichen Klasse mit `T : Number` weist `String` zurück.
6. Neue Klasse mit `fun choose(x: Int) = "int"` und `fun choose(x: String) = "string"`. Beide Menüeinträge und Codepad-Aufrufe treffen die richtige Überladung. Eine private Methode erscheint nicht als öffentliche Aktion; direkter privater Zugriff im Codepad scheitert am Compiler.
7. Interface mit Implementierung kompilieren; Interface ist nicht instanziierbar. `square(7)` liefert `49` aus der Funktionsdatei. Gemischte Top-Level-Klasse/Funktion wird als BlueK-Dateiregelverletzung angezeigt.
8. `println(person1.greet())` erscheint in der Konsole. `askName()` zeigt seine Frage vor Eingabe; Browserzeile Ada setzt denselben Aufruf fort und liefert Ada.
9. Compilerfehler erhält Bench; Laufzeitfehler `error("Demo")` lässt Sitzung bedienbar. Bereits erfolgte Mutationen bleiben erhalten.
10. `while (true) {}` lässt sich stoppen. UI und Server reagieren weiter; Bench wird invalidiert. Auch `System.exit(0)` darf den HTTP-Server nicht beenden.
11. Verspätete Antwort/alte Objekt-ID nach Compile/Reset wird verworfen beziehungsweise abgelehnt. Zwei Browsersitzungen teilen keine Objekte oder Konsolenausgaben.
12. Berechneter Getter mit Seiteneffekt wird durch automatisches Inspect nicht ausgelöst. Neue Compile-Aktion löscht keine Editorquellen.

Automatisiere die Laufzeitproben mit echten Compiler-/Workerprozessen; zusätzliche gezielte Vertragstests für Generationen. Prüfe die Hauptabläufe im Browser. Miss Projektkompilierung und mindestens zwei folgende Snippet-Kompilierungen; keine erfundenen Leistungsversprechen.

## Lieferung

Vollständiger Quellcode, Lockfiles, Gradle-Wrapper und dokumentierter Startbefehl nach Installation der Voraussetzungen. README mit Architektur, Bedienung, Versionsstand, Testergebnissen, Messwerten und klaren PoC-Grenzen. Kurzer Abschlussbericht mit tatsächlich nachgewiesenen Funktionen und offenen Punkten.

Als spätere Schritte lediglich skizzieren: persistente Codepad-Deklarationen, breitere Dialogabdeckung, Projekte speichern/laden, öffentlich isolierter Mehrbenutzerbetrieb und Browseradapter. Keine Garantie formulieren, dass MiniKotlin bereits den Vertrag erfüllt.
