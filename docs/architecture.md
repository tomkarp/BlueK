# Architektur von BlueK

Dieses Dokument ist verbindlich für weitere Arbeit (siehe AGENTS.md). Die
Svelte-Anwendung ist die einzige gepflegte Oberfläche.

Grundsätze:

- **Die Laufzeit ist autoritativ.** Objektzustand, Namensbindungen,
  Klassenmetadaten und Laufphase leben im Worker. Die Oberfläche leitet ihre
  Ansichten aus dem veröffentlichten `RuntimeSnapshot` ab und hält keine
  zweite veränderliche Kopie.
- **Schmale, typisierte Schnittstellen.** Module erhalten nur die Fähigkeiten,
  die sie brauchen (z. B. `InspectorRuntime`, `CodepadClient`).
- **Ein Weg zur Laufzeit.** `LocalRuntimeClient` ist der einzige Zugang;
  kein allgemeiner Event-Bus, kein zweiter Laufzeit-Store, kein alternativer
  Ausführungspfad, kein Backend-Fallback.
- **Keine Kotlin-Grammatik in der Oberfläche.** Typen, Signaturen und
  Diagnosen stammen aus Kotlite.

Verwandte Dokumente: [kotlite.md](kotlite.md) (Interpreter und Fork),
[blueplay.md](blueplay.md) (Spielbibliothek),
[kotlite-generics.md](kotlite-generics.md),
[kotlin-surface.md](kotlin-surface.md).

## Überblick

```text
 Hauptthread (Browser-Tab)                          Web Worker – einer pro Generation
┌────────────────────────────────────────┐         ┌──────────────────────────────────────────┐
│ SvelteApp.svelte                       │         │ runtimeWorker.ts                         │
│  Editor · Karten · Objektbank · Welt   │         │  wertet bluek-kotlite-browser.js aus     │
│  Codepad · Terminal · Inspektorfenster │         │                                          │
│      │ codepadFlow.ts   inspectorModel.ts         │ RuntimeHost (TypeScript)                 │
│      ▼                                 │ Worker- │  Befehle → KotliteSessionBridge          │
│ LocalRuntimeClient                     │ Command │  Phasen, Ereignisse, Snapshot,           │
│  einziger Zugang, Generation/Epoch,    │────────▶│  BluePlay-Scheduler                      │
│  beobachtbarer RuntimeSnapshot         │◀────────│                                          │
│                                        │ Reply / │ KotliteSession (Kotlin/JS)               │
└────────────────────────────────────────┘ Event   │  Sitzungsquelltext, Namensraum, Handles, │
                                                   │  Ein-/Ausgabe, native BluePlay-Engine    │
                                                   │                                          │
                                                   │ Kotlite (vendor/kotlite-interpreter)     │
                                                   │  Lexer → Parser → SemanticAnalyzer →     │
                                                   │  Interpreter (AST-Interpretation)        │
                                                   └──────────────────────────────────────────┘
```

Der Worker hält genau eine `KotliteSession` mit genau einem lebenden
`Interpreter`. Compile ersetzt Worker, Session und Generation vollständig.

## Zuständigkeiten

**Oberfläche (Hauptthread)**

- `SvelteApp.svelte`: Darstellung und Benutzerinteraktion; Projektdokumente,
  Fensterpositionen, Auswahl, Eingabeentwürfe, Dialogzustand,
  Ausgabehistorie. Die Komponente ist groß; weitere Extraktionen richten sich
  nach fachlichen Zuständigkeiten und dürfen keine neuen Objektzustandskopien
  oder Interpreter-Zugänge schaffen. Dateidialoge, Downloads, Clipboard und
  History-Darstellung bleiben dort.
- `localRuntimeClient.ts`: einziger Worker-Zugang. Besitzt Worker, laufende
  Anfragen, Epoche, Generation und den veröffentlichten Snapshot. Die
  Worker-Fabrik wird injiziert: die IDE übergibt `createLocalRuntimeWorker`
  (`localRuntimeWorkerFactory.ts`), der Player seine eigene.
- `codepadFlow.ts`: Compile-on-demand und Codepad-Auswertung. Nutzt nur die
  benötigten Client-Fähigkeiten, liefert typisierte Ergebnisse und verwirft
  Antworten nach einem Generationswechsel. Darstellung, History und Fokus
  bleiben in `SvelteApp.svelte`.
- `inspectorModel.ts`: abgeleitete Inspektoransicht und ausdrücklich
  angeforderte Getter-Auswertung. Keine DOM-, Svelte-, Worker- oder
  Projektdateiabhängigkeit; Schnittstelle zur Laufzeit nur `getSnapshot()`
  und `execute(get)`.
- `runtimeMetadata.ts`: gruppiert das Kotlite-Manifest zu Klassenkarten und
  ergänzt nur geerbte Mitglieder und Funktionskarten pro Datei.
- `mainEntries.ts`: leitet parameterlose `main()`-Einstiegspunkte aus den
  Metadaten ab, nie aus Quelltext.
- `projectFormat.ts`: typisiertes `.bluek.json`-Format. Validiert externe
  `unknown`-Payloads und wandelt Dateien, Ressourcen und Kartenpositionen in
  das interne `ProjectFile`-Modell. Keine DOM-, Svelte- oder
  Runtime-Abhängigkeit; IDs injiziert die Oberfläche.
- `blueJImport.ts`: BlueJ-Projekt (ZIP oder Ordner) → BlueK-Projekt. Wurzel
  ist das flachste `package.bluej`; Kotlin-Dateien werden Karten,
  `images/`/`sounds/` Ressourcen, Positionen kommen aus `package.bluej`.
  Enthält das Projekt die historischen BluePlay-Frameworkdateien, wird die
  eingebaute Library gesetzt und die Dateien entfallen.
- `programExport.ts`, `htmlExport.ts`, `playerMain.ts`, `PlayerApp.svelte`:
  HTML-Export (siehe unten).
- `bluePlayStage.ts`, `imageAlpha.ts`, `standardImages.ts`: Canvas-Ableitung,
  Alpha-Masken und Standardgrafiken für BluePlay (siehe
  [blueplay.md](blueplay.md)).
- `kotlinFormatterClient.ts`: Formatierung über den lokal gebündelten
  ktfmt-WASM-Build im Hauptthread; kein Server- oder CDN-Aufruf, kein
  Einfluss auf den Runtime-Zustand.
- `editorDiagnostics.ts`, `markdownEditor.ts`, `uiParity.ts`, `shareApi.ts`:
  Editor-Markierungen, README-Editor, UI-Hilfsfunktionen (Projektlinks,
  Terminal, Argumentlisten) und Kurzlink-API.

**Worker**

- `runtimeWorker.ts` (`startRuntimeWorker`): wertet das Kotlite-Bundle einmal
  aus und leitet jeden Befehl an einen `RuntimeHost`. Nur die Quelle des
  Bundles unterscheidet sich: `localRuntimeWorker.ts` lädt in der IDE das
  statische Asset per `fetch`; `playerRuntimeWorker.ts` entpackt das
  eingebettete gzip+base64-Bundle (`embeddedKotlite.ts`).
- `runtimeHost.ts`: übersetzt Befehle in die explizite `KotliteSessionBridge`,
  führt Phasen und Ausführungs-IDs, sammelt Ausgaben und passive
  Inspektionen, veröffentlicht zusammenhängende Snapshots und besitzt den
  einzigen BluePlay-Scheduler.
- `kotlite-browser/…/KotliteSession.kt`: Sitzungsquelltext, Interpreter,
  Namensraum und Objekt-Handles, Eingabepuffer und Fortsetzungen, Ausgabe,
  Klassenmanifest, native BluePlay-Funktionen. Alle Ausführungswege benutzen
  denselben Analyse-/Auswertungspfad.
- `BlueKStdlibModule.kt`, `BlueKClass.kt`, `KotlinSurfaceHints.kt`,
  `BluePlayLibrary.kt`, `RuntimeScheduler*.kt`: Stdlib-Ergänzungen,
  `BlueK.beep()`, verständliche Meldungen für fehlende Namen, Kotlin-Quelltext
  der BluePlay-Bibliothek, Checkpoint- und Sleep-Planung über `setTimeout`.
- `vendor/kotlite-interpreter`: Lexer, Parser, semantische Analyse,
  Interpreter; BlueK-Änderungen in `PATCH.md`, Einordnung in
  [kotlite.md](kotlite.md).

**Vertrag**

- `runtime-contract/src/index.ts`: gemeinsame Befehle, Antworten, Snapshot,
  Metadaten und Projekttypen. Es gibt keinen parallelen HTTP-Vertrag.
  Ansichtsdetails werden nicht ins Worker-Protokoll aufgenommen.

## Build

Kotlin-Schülercode wird zu keinem Zeitpunkt in JavaScript oder Bytecode
übersetzt. Zur Build-Zeit entstehen nur der Interpreter (aus Kotlin) und die
Oberfläche (aus Svelte/TypeScript).

```text
 vendor/kotlite-interpreter  ──┐ Gradle-Composite-Build ersetzt
   (Kotlin, Fork-Quellstand)   │ io.github.sunny-chung:kotlite-interpreter
 kotlite-stdlib 1.1.0 (klib) ──┤
   von Maven Central           ├─▶ Kotlin/JS IR ─▶ webpack ─▶ frontend/public/kotlite/
 kotlite-browser (Kotlin)    ──┘   (Kotlin 2.2.21,             bluek-kotlite-browser.js
   KotliteSession, BluePlay, …      Gradle 8.14.1, Java 21)    (~950 KB, eingecheckt)
                                                                   │
                        ┌──────────────────────────────────────────┼──────────────────────┐
                        ▼                                          ▼                      ▼
 build-player.mjs: Vite-IIFE (Player + Worker,        vite build (Svelte 5, TS,     build-offline.mjs:
  Bundle gzip+base64 inline)                           CodeMirror, ktfmt-WASM)       vite build mit
  → public/player/bluek-player.html                    → frontend/dist/              VITE_BLUEK_OFFLINE=1
                                                        (Modul-Worker lädt           → dist-offline/ + ZIP
 build-standard-images.mjs (manuell):                   kotlite/… per fetch)         → public/downloads/
  assets/standard-images → standardImages.generated.ts
```

Reihenfolge in `npm run build`: `build:kotlite` → `build:player` →
`build:offline` → `vite build`. Details und Befehle: DEVELOPMENT.md.

## Laufzeit

### Generationen und Worker

`LocalRuntimeClient.compile` beendet den alten Worker, verwirft alle offenen
Anfragen, erzeugt eine neue `generationId` (UUID), startet einen neuen Worker
und schickt `compile` mit Dateien, Library und Ressourcen. Der Worker wertet
das Interpreter-Bundle aus, `RuntimeHost` legt eine neue `KotliteSession` an
und lädt das Projekt.

Jede Antwort und jedes Ereignis trägt die Generation. Der Client prüft
zusätzlich eine Epoche, der Host eine Ausführungs-ID und bei Eingaben eine
Input-Request-ID. Verspätete oder doppelte Antworten alter Worker werden
verworfen; die UI schließt dazugehörige Dialoge und entwertet Objektverweise.

- **Compile** ersetzt Worker und Generation.
- **Reset** kompiliert den zuletzt an den Client übergebenen Projektstand neu;
  in BluePlay-Projekten ruft es stattdessen die gewählte `main()` in derselben
  Sitzung erneut auf (siehe [blueplay.md](blueplay.md)).
- **Stop** beendet den Worker; danach ist die Laufzeit `uncompiled`.
- Quelltextänderungen invalidieren die Sitzung.

### Phasen

| Phase | Bedeutung |
| --- | --- |
| `uncompiled` | Keine ausführbare Sitzung. |
| `compiling` | Neuer Worker lädt und analysiert das Projekt. |
| `ready` | Ein neuer Befehl ist möglich. |
| `running` | Ein Befehl läuft; konkurrierende Benutzerbefehle werden abgewiesen. |
| `waitingForInput` | Die laufende Ausführung ist an einer Eingabe suspendiert und wartet auf Zeile oder EOF. |
| `faulted` | Laufzeit- oder Transportfehler: Reset oder Compile erforderlich. |

Analysefehler führen zu keiner Ausführung und lassen eine gültige Sitzung
benutzbar; beim Compile bleibt die Laufzeit `uncompiled`, und
Compile-on-demand darf das nicht umgehen. Laufzeitfehler können bereits
Seiteneffekte verursacht haben und sperren die Sitzung (`faulted`). Das ist
**kein Rollback**: Beobachtbare Backing-Felder lassen sich noch passiv
inspizieren, der fehlgeschlagene Aufruf wird weder wiederholt noch anhand
seiner Ausgabe repariert.

### Protokoll

`RuntimeCommand` umfasst `eval`, `main`, `create`, `invoke`, `get`, `set`,
`inspect`, `inspectField`, `bind`, `remove`, `input`, `key`, `click` und
`simulation`; `WorkerCommand` ergänzt `compile`. Der Worker antwortet mit
`WorkerReply` (Ergebnis + Snapshot) und sendet während einer Ausführung
`RuntimeEvent`s (`started`, `output`, `snapshot`, `inputRequested`).

Der `RuntimeSnapshot` enthält Generation, Revision, Phase, Klassenmetadaten,
passive Inspektionen aller gültigen Handles, den Namensraum (`references`),
`liveObjectIds`, Fehler, Simulationszustand und den letzten BluePlay-Frame.
Nach jedem abgeschlossenen Befehl baut `RuntimeHost` ihn neu auf; automatische
BluePlay-Ticks verzichten auf die vollständigen Inspektionen.

Streaming-Ausgabe wird höchstens etwa alle 16 ms veröffentlicht statt einmal
pro `println`. Der erste Text erscheint sofort, ein nachlaufender Timer liefert
Text vor einem längeren `sleep`, Eingabe- und Abschlussereignisse leeren den
Rest.

### Ausführungsmodell: inkrementelle Analyse

Kotlite hat keine öffentliche REPL-Schnittstelle. `KotliteSession` hält deshalb
einen lebenden `Interpreter` und den gesamten bisher erfolgreich ausgeführten
Quelltext der Sitzung (`analysisSource`). Jede Aktion der Oberfläche wird zu
einem kurzen Kotlin-Quelltext:

| Aktion | erzeugter Quelltext (Beispiel) |
| --- | --- |
| Codepad | die Eingabe selbst |
| Konstruktor-Dialog | `val hund1 = Hund("Bello")` |
| Methodenaufruf | `__bluek_expression_3.bellen(2)` |
| Getter / Feld setzen | `__bluek_expression_3.alter` / `__bluek_expression_3.alter = 4` |
| Get auf die Objektbank | `val bello = __bluek_expression_3` |
| Start main | `main()` bzw. der interne Name der gewählten Datei |

Ablauf pro Aktion:

1. `ReplAnalyzer` parst **bisherigen Quelltext + neuen Ausschnitt** frisch und
   analysiert ihn vollständig mit dem `SemanticAnalyzer`.
2. Nur AST-Knoten, deren Quellposition hinter der alten Grenze liegt, werden
   im bestehenden `Interpreter` ausgewertet. Frühere Konstruktoren,
   Initialisierer und Seiteneffekte laufen nicht erneut.
3. Erst bei Erfolg wird der Ausschnitt an die Historie angehängt. Neue
   Property-Deklarationen werden Namensbindungen; jedes Ergebnis außer `Unit`
   erhält ein Handle (siehe unten).

Analysefehler übernehmen weder Quelltext noch Bindungen. Die vollständige
Historie wird erst bei Reset/Compile verworfen; lange Sitzungen verursachen
entsprechend zunehmenden Analyseaufwand.

### Projekt laden

`RuntimeHost` lädt Projektdateien ausschließlich über
`KotliteSession.startLoadProject`. Vor jeder Analyse prüft der Adapter die ASTs
aller Dateien:

- Top-Level nur Klassen/Interfaces, Funktionen und Properties; direkte
  Anweisungen ergeben eine typisierte Diagnose mit Datei, Zeile und Spalte.
  Codepad-Eingaben dürfen dagegen Anweisungen enthalten.
- Eine Datei enthält entweder genau eine Klasse oder Funktionen/Properties.
- Imports nur aus `kotlin.*`.
- Bei aktiver BluePlay-Library sind Dateien namens `World.kt`, `Actor.kt`,
  `Image.kt`, `BluePlayFunctions.kt` unzulässig.

Danach werden alle Dateien zu **einem** Skript `<BlueK project>` verbunden
(je mit Kopfzeile `// BlueK file: Name.kt`), bei BluePlay mit vorangestelltem
Bibliotheksquelltext. Weil alle Dateien ein Skript bilden, erhalten
zusätzliche `main()`-Funktionen interne Namen (`main__Datei`); Manifest und
Karten zeigen weiterhin `main`. Analyse- und Laufzeitfehler werden auf Datei
und Zeile zurückgerechnet, auch hinter dem Bibliotheksquelltext.

Gültige Top-Level-Property-Initialisierer werden beim Laden einmal
ausgeführt, auch mit Ausgabe oder Eingabe. Eine Trennung von Compile und
Initialisierung ist nicht vorgesehen. Vorwärtsverweise zwischen Klassen löst
`ReplAnalyzer` durch Umordnen und erneute Analyse (siehe
[kotlite.md](kotlite.md#technische-schulden)).

### Suspension, Eingabe und Checkpoints

Der Interpreter des Forks wertet AST-Knoten über `suspend`-Funktionen aus.
Dadurch kann eine laufende Ausführung mitten im Schülercode anhalten, ohne
dass der Worker blockiert:

- **Eingabe:** `readln`, `readLine` und `readlnOrNull` sind Host-Funktionen
  mit suspendierender Implementierung. Ist der Eingabepuffer leer, merkt sich
  die Session die Continuation und meldet `inputRequested`. Die Antwort (Zeile,
  leerer String oder EOF) setzt genau diese Continuation fort. EOF ergibt bei
  `readlnOrNull`/`readLine` `null`, bei `readln` einen Fehler.
- **Checkpoints:** `while`, `do-while` und `for` rufen pro Iteration einen
  Checkpoint auf; nach 128 Checkpoints gibt die Session über `setTimeout(0)`
  an die Event-Schleife des Workers ab. So verarbeitet der Worker Eingaben und
  Tastaturereignisse auch während langer Schleifen. Code ohne Schleife (etwa
  tiefe Rekursion) gibt nicht ab; Stop funktioniert trotzdem immer, weil der
  Client den Worker von außen beendet.
- **`Thread.sleep(Int/Long)`** ist eine Kotlite-Bibliotheksfunktion mit
  injiziertem suspendierendem Host-Callback
  (`ExecutionEnvironment.sleepHandler`); BlueK setzt die Ausführung über einen
  Timer fort, ohne Busy-Waiting. Die alte synchrone `evaluate`-API lehnt
  `sleep` ab. Andere Thread-APIs gibt es nicht.
- **Lambdas der binären Stdlib** (`forEach`, `map`, `filter`, `let`,
  `repeat` …) werden synchron aufgerufen. Suspendiert eines, verlässt der
  Interpreter den nativen Stdlib-Aufruf und wiederholt ihn, sobald das Lambda
  fertig ist, mit den gemerkten Callback-Ergebnissen; Schülercode läuft genau
  einmal. Schleifen in synchronen Callbacks geben nicht ab. In `toString()`,
  `equals()`, `hashCode()`, `compareTo()` und anderen nicht wiederholbaren
  Callbacks lehnt die Session Eingabe und `sleep` mit einer Meldung ab
  (`Interpreter.canSuspend`). Einzelheiten:
  [kotlite.md](kotlite.md#suspendierende-lambdas-in-der-stdlib).
- Reset und Stop beenden wartende Fortsetzungen mit dem Worker bzw. der
  Session.

## Klassenkarten-Metadaten

Nach erfolgreichem Laden erzeugt `KotliteSession.manifest()` aus demselben AST,
den Kotlite analysiert hat, ein `SymbolManifest`: Klassen mit Konstruktoren,
Properties (Sichtbarkeit, Getter/Setter), Methoden, Supertypen und
Typparametern sowie Top-Level-Funktionen mit Quelldatei. `runtimeMetadata.ts`
ergänzt nur geerbte Mitglieder und Funktionskarten pro Datei. Private
Methoden erscheinen nicht im Objektmenü. BluePlay-Bibliotheksklassen sind als
`builtin` markiert.

## Objekt- und Referenzmodell

Es gibt drei getrennte Dinge: **Namensbindung**, **Objektidentität** und
**UI-Handle**.

- **Objektidentität:** Objekte bleiben echte Kotlite-Instanzen
  (`ClassInstance`). Konstruktor, Methodenrückgabe, Codepad und Alias zeigen
  auf dieselbe Instanz. Identität heißt `===`, niemals Schüler-`equals`.
- **Namensbindung:** `KotliteSession` hält für jeden Namen nur das stabile
  Kotlite-Symbol, die Herkunft (`interactive` oder `persistent`) und
  `onBench`. Der aktuelle Wert wird immer aus dem Interpreter gelesen, nie in
  einer zweiten Alias-Tabelle gespeichert. Deshalb folgt eine
  Objektbank-Ansicht auch einer späteren `var`-Zuweisung.
- **Handle:** eine `objectId` wie `object-4`, intern gebunden an eine
  synthetische Deklaration `val __bluek_expression_N: Typ` ohne Initialisierer,
  deren Wert direkt in die Symboltabelle geschrieben wird. Darüber adressieren
  Methodenaufrufe, Getter und Setter das Objekt, ohne es neu zu erzeugen.

Codepad-Variablen und Projekt-Properties sind `persistent`; Namen aus dem
Konstruktor-Dialog oder aus „Get“ unter neuem Namen sind `interactive`.
Codepad und Objektbank teilen sich einen Namensraum:

- Interaktives Erzeugen deklariert den eingegebenen Namen direkt.
- `bind` auf denselben Namen und dieselbe Instanz ist idempotent und blendet
  nur die Objektbank-Ansicht ein. Ein freier Name legt einen interaktiven
  Alias an. Ein vorhandener Name für einen anderen Wert ist ein Konflikt.
- `remove` entfernt interaktive Bindungen aus dem Interpreter und gibt den
  Namen frei; bei persistenten Bindungen setzt es nur `onBench = false`.
  Ein veralteter Remove-Auftrag mit falscher Identität wird abgewiesen.

`referenceSnapshot()` liefert den gemeinsamen Namensraum und die gültigen
Handles. `RuntimeHost` veröffentlicht daraus `references`, `liveObjectIds` und
die passiven Inspektionen; Svelte leitet die Objektbank daraus ab
(`references` mit `onBench`). Es gibt keine zweite Liste löschbarer Namen.
Nach einem Namenswechsel wird der Inspektortitel aus den noch gültigen
Referenzen abgeleitet.

Beispiel: Nach interaktivem Erzeugen von `timer1` und `val t3 = timer1` kann
`timer1` entfernt werden. `t3` funktioniert weiter, ebenso eine unabhängige
Eingabe wie `val a = 5`. Ein später neu erzeugtes `timer1` ist eine neue
Referenz und verändert `t3` nicht.

### Analyse-Historie und Namensfreigabe

Erfolgreich ausgeführter Quelltext bleibt **unveränderlich** in der Historie,
auch Anweisungen und Blöcke mit lokalen Variablen. Das erhält Kotlites
laufende Symbolnummern. Das Löschen alter Quelltextblöcke oder erneutes
Ausführen von Alias-Initialisierern ist ausdrücklich falsch.

Eine Namensfreigabe wird als Analyse-Ereignis an der aktuellen
Quelltextgrenze gespeichert. `ReplAnalyzer`/`SemanticAnalyzer` analysieren alte
Verwendungen noch unter ihrer damaligen Bindung und entfernen anschließend den
Namen samt Symbolabbildung aus dem Analyseskopus. Eine spätere Deklaration
desselben Namens bekommt eine neue Symbolnummer. `val t3 = timer1` bleibt
damit historisch analysierbar, während neue direkte Zugriffe auf das gelöschte
`timer1` abgewiesen werden.

### Erreichbarkeit

Namenslose Ergebnisse sind zunächst übernehmbar. Sobald ein Wert über den
Namensraum erreichbar war, ist sein Handle nur noch eine Ansicht und kein
zusätzlicher Eigentümer. Nach abgeschlossenen Ausführungen und nach Remove
wird die Erreichbarkeit aus den aktuellen Namensbindungen neu bestimmt; nicht
mehr erreichbare Handles werden ungültig, Inspektoren schließen sich, alte
Ergebnis-Schaltflächen werden deaktiviert. Ein frisches Ergebnis wie
`items.removeAt(0)` darf einen gerade abgetrennten Wert erneut anbieten; dafür
wird ein neues vorläufiges Handle vergeben, frühere bleiben ungültig.

`reachableRuntimeValues` (Fork) verfolgt Backing-Felder einschließlich
Vererbung, Lambda-Captures, native Collections/Maps/Paare und explizite
Referenzen von Host-Wrappern. Identitätsbasierte Zyklenerkennung verhindert
Endlosschleifen; Getter, Schüler-`equals` und lazy Iteratoren werden dabei
nicht ausgeführt. Globale Lambda-Captures halten ihren Property-Holder, auch
wenn der ursprüngliche interaktive Name entfernt oder neu vergeben wird. Der
Iterator-Wrapper hält seine Quell-Collection über `retainedRuntimeValues`.
Weitere opake Host-Wrapper müssen ihre internen Referenzen ebenfalls über
diesen Vertrag offenlegen; beliebige native Closures lassen sich nicht
passiv traversieren. Das Modell entwertet UI-Handles; es ersetzt nicht den
Garbage Collector von JavaScript.

Regressionen: `test:references`, `test:runtime-state`,
`tests/gui/references.spec.ts`.

## Inspektor

Die Laufzeit ist die Quelle gespeicherter Feldwerte. Inspektorfenster
enthalten nur Objekt-ID und Position; der aktive Inspektor wird über seine ID
ausgewählt. Die gemeinsame Fensteraktivierung ordnet Inspektor, Editor und
Terminal im Z-Stapel.

**Passiv (bei jedem Snapshot):** `KotliteSession.inspect` liest für jede
Property der Klasse (einschließlich geerbter, aus dem AST gesammelt) das
Backing-Feld über `ClassInstance.readBackingPropertyByDeclaredName`, eine
Erweiterung des Forks. Dabei läuft kein Schülercode: kein Getter, kein
`toString()` (Anzeige über `convertToString(isCallCustomFunction = false)`);
Collections zeigen Größe und die ersten fünf Elemente. Properties mit
eigenem Getter erscheinen als `<computed>`. Eine Property nur mit eigenem
Setter liest weiterhin ihr Backing-Feld. Objektwertige Felder sind als
Referenz markiert; `inspectField` folgt ihnen, ohne Getter auszuführen, und
vergibt dafür ein Handle.

**Explizit:** `InspectorModel` hält ausschließlich Ergebnisse ausdrücklich
ausgewerteter Getter. Rendern oder das Empfangen eines Snapshots löst keine
Getter aus, denn Kotlin-Getter können Seiteneffekte haben. Nach
Benutzeroperationen fragt die Oberfläche offene Inspektoren gezielt ab (ein
`get`-Befehl pro `<computed>`-Feld); parallele Refreshes desselben Objekts
werden übersprungen. Getter-Ergebnisse gelten nur für ihre Generation;
Reset/Compile und Schließen eines Fensters entwerten ausstehende Ergebnisse.
Transportfehler bleiben in der Laufzeit, fachliche Getter-Fehler sind Teil der
Ansicht.

Feldänderungen laufen als normaler `set`-Befehl auf das Handle des
Fensters. Typinformationen stammen aus Kotlite, nicht aus dem Format des
angezeigten Werts. Während eines laufenden BluePlay-Ticks liefert `inspect`
den Stand des letzten abgeschlossenen Schritts.

## Codepad

`executeCodepad` kompiliert bei Bedarf, sendet `eval` und verwirft das
Ergebnis, falls sich die Generation inzwischen geändert hat. Im Worker ist das
ein gewöhnlicher Aufruf von `startEvaluate("<Codepad>", code)` mit dem oben
beschriebenen inkrementellen Ablauf. Jeder Wert außer `Unit` erhält ein
Handle – auch `Int` und `String` –, damit die Oberfläche ihn als roten
Ergebniskasten anbieten kann. „Get“ ruft `bind` auf. Variablen bleiben bis
Compile/Reset bestehen; Übernahme unter einem vorhandenen Namen für dasselbe
Objekt blendet nur die Objektbank-Ansicht ein, Entfernen blendet sie wieder
aus, ohne die Variable zu löschen.

## Projektdateien und main

Wie in Kotlin darf jede Datei ein eigenes `main()` deklarieren. `Start main`,
BluePlay-Reset und HTML-Export ermitteln parameterlose Top-Level-Einstiegspunkte
mit `mainEntries.ts` aus den Metadaten der aktuellen Generation. Bei genau
einem starten sie ihn unabhängig vom Dateinamen; bei mehreren zeigt Svelte bei
jedem Aufruf eine Dateiauswahl, Abbrechen führt nichts aus. Der Dialog hält nur
Aktion und Generation; Compile/Invalidierung schließt ihn. Es gibt keine
gespeicherte Auswahl.

Die Ausführung erhält die Datei ausdrücklich (`main.fileName`,
`simulation.reset.fileName`); `RuntimeHost` validiert sie gegen die
Metadaten. Ein Reset ohne Dateiangabe ist nur mit genau einem Kandidaten
zulässig; fehlende oder mehrdeutige Ziele sind nicht fatale
Anforderungsfehler. Der unqualifizierte Codepad-Aufruf `main()` bleibt an
`Main.kt` gebunden, falls dort eine `main` existiert, sonst an die erste Datei
mit `main`; die Projektaktionen verwenden diese implizite Bindung nicht.

## HTML-Export (Player)

Ein Export ist eine einzelne HTML-Datei ohne Server- oder Netzwerkzugriff.

- `scripts/build-player.mjs` baut die Vorlage
  `frontend/public/player/bluek-player.html`: Player-Code (`playerMain.ts`,
  `PlayerApp.svelte`), der Player-Worker als Text und darin das
  gzip+base64-Kotlite (`virtual:bluek-kotlite-gzip` aus
  `frontend/build/embeddedKotlite.mjs`) stehen inline, dazu ein leeres
  `<script type="application/json" id="bluek-program">`. `<\/script` und
  `<!--` werden beim Einbetten des Codes maskiert. Das Entpacken nutzt
  `DecompressionStream` ohne `Blob.stream()`, das in WebKit unter `file://`
  scheitert.
- `programExport.ts` definiert das Format
  `{ format: "bluek-program", version: 1, mainFile, blueKUrl, project }`.
  `project` ist unverändert das `.bluek.json`-Format und wird mit dessen
  Validierung geprüft; `mainFile` muss eine Projektdatei sein. Beim Einsetzen
  werden `<`, `>`, `&`, U+2028 und U+2029 als `\uXXXX` geschrieben, sodass
  Quelltexte das Element weder schließen noch Skripte einschleusen können.
  `blueKUrl` ist die exportierende Instanz, bei localhost/Offline-Paket
  `https://bluek.de/`.
- `playerMain.ts` startet den Worker aus einer Blob-URL (funktioniert auch
  unter `file://`). `PlayerApp` nutzt dieselben Bausteine wie die IDE:
  `LocalRuntimeClient`, `projectModelFromPayload`, `mainFiles`,
  `prepareRuntimeResources` mit Standardgrafiken und `bluePlayStage.ts`. Er
  kompiliert beim Laden und prüft `mainFile`. Konsolenprogramme starten
  sofort, „Restart“ kompiliert neu. BluePlay-Programme führen `reset(mainFile)`
  aus und zeigen die Welt pausiert mit Step, Run/Pause, Reset und Speed.
  „Download project“ speichert `program.project`, „Open in BlueK“ verlinkt
  `blueKUrl#bluek=…`, solange der Link höchstens 1 MB lang ist.
- In der IDE startet „Export as HTML (Beta)“ im Save/Export-Dialog den Export. Er
  kompiliert bei Bedarf, fragt bei mehreren `main()` nach, prüft vor dem
  Schreiben, dass die Generation unverändert ist, lädt die Vorlage von
  `<BASE_URL>player/bluek-player.html` und speichert `<Projektname>.html`.

## BluePlay

BluePlay ist eine versionierte Projekt-Library (`{ id: "blueplay", version: 1 }`),
kein Satz editierbarer Framework-Dateien. `World`, `Actor` und `Image` sind
Kotlin-Quelltext, der zusammen mit dem Projekt interpretiert wird;
rechenintensive Teile (Weltregister, Kollision, Rendering, Eingabezustand)
sind native Host-Funktionen der Session. Die Session ist die einzige Quelle
von Welt-, Actor-, Bild- und Kollisionszustand; `RuntimeHost` besitzt den
einzigen Scheduler; die Oberfläche leitet Canvas, Bibliothekskarten und
API-Dokumentation aus dem typisierten `BluePlayStage` ab. Einzelheiten:
[blueplay.md](blueplay.md).

## Generische Funktionen und Inline-Kontrollfluss

Typauflösung, lexikalische Captures und Inline-Parameterregeln gehören zum
vendorten Interpreter. Svelte und Worker-Protokoll erhalten dafür keine
Typkopien oder Quelltext-Ersetzungen. Der Analyzer ordnet Returns
lexikalischen Callables zu; zur Ausführung erhält jeder Aufruf ein eigenes
Rücksprung-Token, Lambdas erfassen benötigte Tokens zusammen mit Variablen und
Typaliasen. Dadurch bleiben Rekursion und Suspendierung korrekt, und
Kotlin-`catch` fängt keinen internen Return ab; `finally` läuft trotzdem.
Details und Host-Schnittstelle: [kotlite-generics.md](kotlite-generics.md).

## Bekannte technische Schulden und nächste Grenzen

- **Vollständige Neuanalyse:** Jede Aktion analysiert den gesamten
  Sitzungsquelltext. Eine echte inkrementelle Symboltabelle gehört in
  Kotlite.
- **Vorwärtsverweise** erkennt `ReplAnalyzer` anhand von Fehlermeldungen und
  löst sie durch Umordnen und wiederholte Analyse; die endgültige Lösung ist
  eine Zwei-Pass-Deklarationsanalyse in Kotlite.
- **Metadaten:** Generische Oberklassentypen und ihre Spezialisierung sind
  noch nicht umfassend geprüft; einige ältere UI- und BluePlay-Datenstrukturen
  sind dynamisch typisiert. Der Runtime-Befehlsweg ist typisiert.
- **UI-Struktur:** `SvelteApp.svelte` ist groß. Weitere Aufteilung ist
  erwünscht, solange keine Objektzustandskopien oder zusätzlichen
  Laufzeitzugänge entstehen.
- Projektformat und Compile-/Codepad-Ablauf liegen bereits hinter kleinen
  Schnittstellen; Methodenaufrufe und BluePlay-Abläufe noch nicht.

Absicherung: [regression-checklist.md](regression-checklist.md);
Modelltests für Lebensdauer und Nebenläufigkeit, echte Browsertests für
sichtbare Aktualisierung und Bedienung.
