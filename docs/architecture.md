# Architektur von BlueK

Die Svelte-Anwendung ist die einzige gepflegte BlueK-Oberfläche und die
verbindliche Basis für weitere Arbeit.
Archivierter Vergleichs-Commit: `ff1f5d7`.

## Zuständigkeiten

- `SvelteApp.svelte`: Darstellung und Benutzerinteraktion; Fensterpositionen,
  Auswahl, Eingabeentwürfe und Dialogzustand. Die Komponente ist weiterhin groß;
  weitere Extraktionen sollen sich an fachlichen Zuständigkeiten orientieren.
- `inspectorModel.ts`: abgeleitete Inspektoransicht und ausdrücklich angeforderte
  Getter-Auswertung. Keine DOM-, Svelte-, Worker- oder Projektdateiabhängigkeit.
  Schnittstelle zur Laufzeit: nur `getSnapshot()` und `execute(get)`.
- `LocalRuntimeClient`: einziger Worker-Zugang, laufende Befehle, Phasen,
  Generationen und veröffentlichter Laufzeit-Snapshot.
- `projectFormat.ts`: typisiertes Projektdateiformat. Validiert externe
  `unknown`-Payloads und wandelt gespeicherte Dateien, Ressourcen und
  Kartenpositionen in das interne `ProjectFile`-Modell um. Keine DOM-, Svelte-
  oder Runtime-Abhängigkeit; IDs werden von der Oberfläche injiziert.
- `codepadFlow.ts`: schmale Ablaufsteuerung für Compile-on-demand und
  Codepad-Evaluation. Nutzt nur die benötigten Client-Fähigkeiten, gibt
  typisierte Compile-/Ausführungsergebnisse zurück und verwirft Antworten
  nach einem Generationswechsel. Darstellung, History und Fokus bleiben in
  `SvelteApp.svelte`.
- `kotlinFormatterClient.ts`: asynchrone CodeMirror-Formatierung über den
  lokalen ktfmt-WASM-Build im Hauptthread. Vite bündelt WASM und Laufzeit in
  die Anwendung; es gibt keinen Server- oder CDN-Aufruf. Der Formatter
  verändert keinen Runtime-Zustand.
- `RuntimeHost` und Kotlin-Session: Ausführung und tatsächlicher Objektzustand.
- `runtime-contract`: gemeinsame Transporttypen. Ansichtsdetails werden nicht
  dem Worker-Protokoll hinzugefügt.

## Projektdateien und Codepad

`RuntimeHost` lädt Projektdateien ausschließlich über `KotliteSession.startLoadProject`.
Dieser Adapter prüft die ASTs aller Dateien auf erlaubte Top-Level-Deklarationen
(Klassen/Interfaces, Funktionen und Properties), bevor die gemeinsame semantische
Analyse und irgendeine Ausführung beginnen. Direkte Anweisungen werden mit
Dateiname, Zeile und Spalte als typisierte Diagnose zurückgegeben. Die Oberfläche
implementiert keine eigene Kotlin-Grammatik. Kotlites vorhandener Sprachumfang
wird dadurch nicht erweitert.

Nach einem Analysefehler bleibt die Laufzeit `uncompiled`; Compile-on-demand
darf die Prüfung nicht umgehen. Codepad verwendet weiterhin `startEvaluate`
und erlaubt direkte Anweisungen. Gültige Property-Initialisierer werden beim
Laden weiterhin einmal ausgeführt, auch mit Ausgabe oder Eingabe; eine Trennung
von Compile und Initialisierung ist nicht Teil dieser Grenze.

`Thread.sleep(Int/Long)` ist eine Kotlite-Bibliotheksfunktion mit einem
injizierten suspendierenden Host-Callback (`ExecutionEnvironment.sleepHandler`).
BlueK setzt die Ausführung im Worker über einen Timer fort; weder Busy-Waiting
noch zusätzliche Java-Threads sind erforderlich. Die normale asynchrone
`start*`-API unterstützt das Warten, die alte synchrone `evaluate`-API lehnt es
vor dem Anlegen eines Timers ab. Reset beendet wie bisher den Worker mitsamt
wartenden Fortsetzungen. Andere Thread-APIs werden dadurch nicht bereitgestellt.

## BluePlay-Library und World-Scheduler

BluePlay ist eine versionierte Projekt-Library (`{ id: "blueplay", version: 1 }`)
und kein Satz editierbarer Framework-Dateien. Beim Laden kombiniert die Kotlin-
Session die eingebaute Deklaration von `World`, `Actor`, `Image` und den
Top-Level-Funktionen mit den Schülerdateien. Alte BluePlay-Projekte dürfen die
historischen Framework-Dateien noch enthalten; der Projektimport filtert sie
bei ausgewiesener Library heraus. Fremde oder fehlende Library-Versionen werden
im typisierten Projektformat abgewiesen.

Die Session bleibt die einzige Quelle von World-, Actor-, Bild- und
Kollisionszustand. `runtime-contract` transportiert einen typed
`BluePlayStage`-Snapshot sowie den Simulationszustand; die Svelte-Oberfläche
leitet daraus die Built-in-Karten, API-Doku und den Canvas-Frame ab. Medien
bleiben projektbezogene, validierte Data-URL-Ressourcen und werden nicht in die
Kotlin-Library kopiert.

`RuntimeHost` besitzt den einzigen Scheduler: `step`, `start`, `stop`, `reset`
und `setSpeed` sind versionierte Runtime-Kommandos. Der Worker plant den
nächsten Schritt mit `max(1, 100 - speed)` Millisekunden; der Client hält keinen
zweiten Simulationstimer. Während eines laufenden Schritts bleiben Tastatur-
und Mausereignisse zulässig, normale Codepad-/Objektoperationen werden bis zum
Pause-Zustand abgewiesen. Reset stoppt zunächst, ruft danach das
parameterlose `main()` direkt in derselben Session auf und meldet einen
verständlichen Fehler, falls es fehlt oder mehrdeutig ist.

Die sichtbare World ist ein einzelnes BlueJ-artiges Fenster aus Titelleiste,
Canvas und eingebetteter Steuerleiste. Die Titelleiste verschiebt den gesamten
Container; `Run`, `Pause` und der per Drag bedienbare Speed-Regler verwenden
weiterhin ausschließlich den Worker-Scheduler. Ein normales `World.show()`
setzt kein Stop-Signal; nur die fachliche `stop()`-Aktion beendet den nächsten
Lauf. Pointerkoordinaten werden aus den tatsächlichen Canvas-Grenzen und
`cellSize` berechnet. Der Browser prüft Actor in umgekehrter Zeichenreihenfolge,
transformiert den Weltpunkt unter Berücksichtigung der Rotation in das lokale
Bild und übergibt die stabile Treffer-ID nur bei einem sichtbaren Pixel.
Bilder und Zeichenoperationen werden erst im UI aus dem typed Frame und
Projektressourcen gerendert. Nicht geladene Bilder erhalten einen
deterministischen, vollständig treffbaren Platzhalter.

Die Canvas-CSS-Größe entspricht dabei immer `width * cellSize` und
`height * cellSize`; das World-Fenster skaliert kleine oder große Welten nicht
automatisch. Der umgebende Body ist scrollbar und erhält bei einer Welt, die
kleiner als die Steuerleiste ist, einen grauen Surround. Seine Breite wächst
dynamisch mit Welt und Steuerleiste bis knapp an die Browsergrenzen, sodass
große Welten den verfügbaren Platz möglichst vollständig nutzen, bevor der
Body scrollen muss. Der Maximieren-Modus setzt das Fenster auf den vollständigen
Browser-Viewport (`100vw`/`100vh`); auch dort bleibt die Canvas unskaliert und
der verfügbare Body kann bei kleinen Welten grau sichtbar bleiben.
Der World-Body zentriert die unvergrößerte Canvas horizontal und vertikal; bei
ausreichender Breite wird kein pauschaler zusätzlicher Seitenrand reserviert.

Die vier BluePlay-Bibliothekselemente erscheinen im Kartenbereich als normale
Karten, sind aber keine Schülerdateien und werden nicht kompiliert. Ihre
virtuellen Karten nehmen an Dragging, Vererbungsdarstellung und der
Positionierung neuer Schülerklassen teil. Doppelklick und Kontextmenü öffnen
jeweils nur die API-Dokumentation der gewählten Bibliotheksdatei.

Bildressourcen werden vor dem Compile einmal im Browser dekodiert. Nur Breite,
Höhe und die Alpha-Maske gelangen als flüchtige Runtime-Metadaten in den
Worker; Export und Autosave enthalten weiterhin ausschließlich Pfad und
Data-URL. `intersects`/`isTouching` verwenden nach einem gedrehten AABB-
Schnelltest dieselbe Weltpixel-Geometrie, inverse Rotation, Skalierung und den
effektiven Alpha-Schwellwert `> 16`. Transparente PNG-Bereiche lösen daher
weder Klicks noch Kollisionen aus. Die stabile Actor-ID und die kanonische
Identität über Kotlites Vererbungsteile erlauben außerdem, dass ein Actor in
seinem eigenen `act()` sicher `world.removeObject(this)` ausführt.

Die API-Matrix des eingebauten Vertrags sieht derzeit so aus:

| Einheit | Öffentliche Oberfläche | Status/Nachweis |
| --- | --- | --- |
| `World` | `World(width, height, cellSize = 1)`, `background: Image`, `show`, `act`, `addObject`, `removeObject`, `allObjects`, `getObjects<T>`, `getObjectsAt`, `numberOfObjects`, `isClicked`, `setBackground`, `showText` | Native Bibliothek, studentische Unterklassen, World-Callback, Objektlebensdauer, Text/Bild-Frames in `smoke-blueplay-browser.mjs` |
| `Actor` | `x`, `y`, `rotation`, `image: Image?`, `world`, `act`, `setImage`, `getImage`, `move`, `turn`, `turnTowards`, `distanceTo`, `intersects`, `isTouching`, `getIntersecting<T>`, `getOneIntersecting<T>`, `removeTouching<T>`, `isAtEdge`, `isClicked` | Native Unterklasse, direkter dynamischer `act`-Aufruf, Reified-Suche, Input und Identität im Browser-Smoke |
| `Image` | `Image(width, height)`, `Image(fileName)`, `Image(other)`, `width`, `height`, `path`, `transparency`, `setColor`, `fill`, `fillRect`, `drawRect`, `fillOval`, `drawOval`, `drawLine`, `drawString`, `drawImage`, `clear`, `scale`, `setTransparency` | Copy-/Shared-Instanz, Zeichenoperationen, Skalierung, Transparenz und Canvas-Frame geprüft |
| Funktionen | `currentWorld`, `activeWorld`, `showWorld`, `show`, `isKeyDown`, `start`, `stop`, `step`, `getSpeed`, `setSpeed`, `playSound` | Native Bridge, Input-/Sound-Effekt, Scheduler- und Reset-Smokes |

Die Matrix beschreibt die vorhandene Oberfläche, nicht eine Zusage für JVM-
Interna. Für geladene Rasterressourcen sind Alpha, Rotation und Skalierung
pixelgenau abgedeckt; die einfachen `Image`-Zeichenoperationen verwenden eine
äquivalente geometrische Maske. Eine 60-Sekunden-/100-Actor-Performance-
Messung steht noch aus.

## Objekt- und Referenzmodell

Es gibt drei getrennte Dinge: **Namensbindung**, **Objektidentität** und
**UI-Handle**. `KotliteSession` hält für jeden Namen nur das stabile Kotlite-
Symbol, seine Herkunft (`interactive` oder `persistent`) und `onBench`.
Der aktuelle Wert wird immer aus dem Interpreter gelesen, nicht in einer
zweiten Alias-Tabelle gespeichert. Deshalb folgt eine Objektbank-Ansicht auch
einer späteren `var`-Zuweisung. Codepad- und Projekt-Properties sind persistent.

Interaktives Erzeugen deklariert den eingegebenen Namen direkt. `bind` auf
denselben Namen und dieselbe Instanz ist idempotent und ändert die Herkunft
nicht; ein freier Name legt einen interaktiven Alias an, ein anderer Wert ist
ein Konflikt. `remove` entfernt interaktive Bindungen aus dem Interpreter;
bei persistenten Bindungen setzt es nur `onBench = false`. Ein veralteter
Remove-Auftrag mit falscher Objektidentität wird abgewiesen.

`referenceSnapshot()` liefert den gemeinsamen Namensraum und die gültigen
Handles. `RuntimeHost` veröffentlicht daraus `RuntimeSnapshot.references`,
`liveObjectIds` und passive Inspektionen. Svelte leitet die Objektbank daraus
ab. Es gibt keine zweite Liste löschbarer Namen oder Host-eigene Handle-Liste.
Alte Ergebnis-Schaltflächen werden deaktiviert und verwaiste Inspektoren
geschlossen. Nach Namenswechsel wird der Inspektortitel aus den noch gültigen
Referenzen abgeleitet, nicht als alte Namensbindung weiterverwendet.

### Analyse-Historie und Namensfreigabe

Erfolgreich ausgeführter Quelltext bleibt **unveränderlich** in der Historie,
auch Anweisungen und Blöcke mit lokalen Variablen. Das erhält Kotlites laufende
Symbolnummern. Nur der neue Quelltextbereich wird ausgeführt; alte Initialisierer
und Seiteneffekte werden nicht wiederholt. Das Löschen alter Quelltextblöcke
oder erneutes Ausführen von Alias-Initialisierern ist ausdrücklich falsch.

Eine Namensfreigabe wird zusätzlich als Analyse-Ereignis an der aktuellen
Quelltextgrenze gespeichert. `ReplAnalyzer`/`SemanticAnalyzer` analysieren alte
Verwendungen noch unter ihrer damaligen Bindung und entfernen anschließend
den Namen samt Symbolabbildung aus dem Analyseskopus. Eine spätere Deklaration
desselben Namens bekommt eine neue Symbolnummer. `val t3 = timer1` bleibt damit
historisch analysierbar, während neue direkte Zugriffe auf das gelöschte
`timer1` abgewiesen werden. Analysefehler übernehmen weder Quelltext noch neue
Bindings. Die vollständige Historie wird erst bei Reset/Compile verworfen;
lange Sitzungen verursachen entsprechend zunehmenden Analyseaufwand.

### Erreichbarkeit

Handles werden anhand echter Identität (`===`, niemals Schüler-`equals`)
kanonisiert. Namenslose Ergebnisse sind zunächst übernehmbar. Sobald ein Wert
über den Namensraum erreichbar war, ist sein Handle nur noch eine Ansicht und
kein zusätzlicher Eigentümer. Nach abgeschlossenen Ausführungen und Remove
wird die Erreichbarkeit aus den aktuellen Namensbindungen neu bestimmt.
Ein frisches Ergebnis wie `items.removeAt(0)` darf einen gerade abgetrennten
Wert erneut anbieten. Dafür wird ein neues vorläufiges Handle vergeben;
frühere Ergebnis-Handles bleiben ungültig.

`RuntimeReachability` verfolgt Backing-Felder einschließlich Vererbung,
Lambda-Captures, native Collections/Maps/Arrays/Paare und explizite Referenzen
von Host-Wrappern. Identitätsbasierte Zyklenerkennung verhindert Endlosschleifen;
Getter, Schüler-`equals` und lazy Iteratoren werden dabei nicht ausgeführt.
Globale Lambda-Captures halten wie lokale Captures ihren Property-Holder,
auch wenn der ursprüngliche interaktive Name entfernt oder neu vergeben wird.
Der Iterator-Wrapper hält seine Quell-Collection über `retainedRuntimeValues`.
Weitere opake Host-/Bibliothekswrapper (etwa lazy Sequenzen) müssen ihre
internen Referenzen ebenfalls explizit über diesen Vertrag offenlegen;
beliebige native Closures lassen sich nicht automatisch passiv traversieren.

Regressionen: `test:references` (echtes Kotlin/JS-Bundle in Node),
`test:runtime-state` (Client/Host/Session-Integration) und
`tests/gui/references.spec.ts` (echter Browser).

## Inspektor: Datenfluss und Lebensdauer

Die Laufzeit ist die Quelle gespeicherter Feldwerte. Fenster enthalten nur ID
und Position; der aktive Inspektor wird über seine ID ausgewählt. Ansichten
werden abgeleitet und nicht als weitere Kopien von Objektdaten gepflegt.

Das Inspektormodell hält ausschließlich Ergebnisse expliziter Getter-Aufrufe.
Rendern oder das Empfangen eines Snapshots löst keine Getter aus: Kotlin-Getter
können Seiteneffekte haben. Nach Benutzeroperationen werden offene Inspektoren
gezielt aktualisiert. Parallele Refreshes desselben Objekts werden übersprungen.

Getter-Ergebnisse gelten nur für ihre Runtime-Generation. Reset/Compile sowie
Schließen eines Fensters entwerten ausstehende Ergebnisse. Transportfehler
bleiben in der Laufzeit, fachliche Getter-Fehler sind Teil der Ansicht.

## Nächste sinnvolle Grenzen

Projektdateiformat und der Compile-/Codepad-Ablauf liegen hinter konkreten,
kleinen Schnittstellen. Dateidialoge, Downloads, Clipboard, Dialoge und
History-Darstellung bleiben in `SvelteApp.svelte`; Methodenaufrufe, BluePlay
und weitere Abläufe sind davon bewusst nicht erfasst. Kein allgemeiner
Event-Bus und kein zweiter Laufzeit-Store.

Absicherung: `docs/regression-checklist.md`; Modelltests für Lebensdauer und
Nebenläufigkeit, echte Browsertests für sichtbare Aktualisierung und Bedienung.

## Generische Funktionen und Inline-Kontrollfluss

Typauflösung, lexikalische Captures und Inline-Parameterregeln gehören zum
vendorten Kotlite-Interpreter. Svelte und Worker-Protokoll erhalten dafür keine
zusätzlichen Typkopien oder Quelltext-Ersetzungen. Die konkrete Host-Schnittstelle
ist in `docs/kotlite-generics.md` beschrieben.

Der Analyzer ordnet Returns lexikalischen Callables zu. Zur Ausführung erhält
jeder Aufruf ein eigenes Rücksprung-Token; Lambdas erfassen benötigte Tokens
zusammen mit ihren Variablen und Typaliasen. Nur der passende Aufruf fängt den
Kontrollfluss ab. Dadurch bleiben Rekursion und Suspendierung korrekt, und
Kotlin-`catch` fängt keinen internen Return ab; `finally` wird trotzdem ausgeführt.
`GenericCollectionsModule` und `StdlibInlineMetadata` kapseln allgemeine
Bibliotheksfunktionen bzw. die fehlenden Inline-Metadaten der alten Binärbibliothek.
