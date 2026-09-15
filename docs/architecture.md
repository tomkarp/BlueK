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
- `kotlinFormatterClient.ts` und `kotlinFormatterWorker.ts`: asynchrone
  CodeMirror-Formatierung über den lokalen ktfmt-WASM-Build. Vite bündelt den
  Worker, das WASM und die Laufzeit in die Anwendung; es gibt keinen Server-
  oder CDN-Aufruf. Der Worker ist eine reine Hilfskomponente für die
  Formatierung und verändert keinen Runtime-Zustand.
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
