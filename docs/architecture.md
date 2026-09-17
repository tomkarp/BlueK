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
