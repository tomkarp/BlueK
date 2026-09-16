# BlueK Regressionen und offene GUI-Punkte

Diese Liste wird bei jeder Änderung an einem erfassten Verhalten mitgepflegt.
Eine Nutzerbestätigung ersetzt keinen automatisierten Test. Ein Hilfsfunktionstest
belegt noch kein sichtbares GUI-Verhalten. Fehlgeschlagene oder nicht ausgeführte
Prüfungen bleiben ausdrücklich offen. BluePlay-Laufzeitfunktionen sind derzeit
nicht im Fokus; die Projektauswahl bleibt enthalten.

## Durchführung

- `npm run test:regression`: Typecheck, UI-Hilfsfunktionen, echte Laufzeit und GUI.
- `npm run test:gui`: isolierter Chromium-Browser mit eigenem Vite-Testserver.
- Einmalig nach `npm ci`: `npx playwright install chromium`.
- `npm run build:svelte`: Produktionsbuild separat prüfen.
- GUI-Bericht: `playwright-report/`; Fehlerbilder und Traces: `test-results/`.
- Nach Kotlin-Änderungen zuerst `npm run build:kotlite`; Tests verwenden das
  gebaute Bundle unter `frontend/public/kotlite/`.
- Neue Fehler erhalten eine ID und möglichst einen reproduzierbaren Test, bevor
  sie korrigiert werden. Bei Änderungen betroffene Nachbarabläufe mitprüfen.
- Keine Tests als bestanden markieren, die nur geschrieben, aber nicht ausgeführt wurden.

## Checkliste

| ID | Erwartetes Verhalten / Reproduktion | Bisheriger Nachweis | Automatisierung / offen |
| --- | --- | --- | --- |
| GUI-01 | New Project: vier Vorlagen wählbar, separate Hilfe, Cancel schließt | GUI grün: alle Vorlagen erzeugt, Cancel | Visuelle Abnahme und Hilfe-Interaktion offen |
| GUI-02 | Neue Instanz heißt standardmäßig hund1, danach hund2 | GUI grün: beide Konstruktor-Dialoge und Bench | Abgesichert |
| GUI-03 | Computed Property zeigt im Inspektor den Wert | Nutzerbestätigung + GUI grün mit echtem Getter | Abgesichert |
| GUI-04 | Nach jeder Änderung im Inspektor sofort aktueller Getter-Wert, keine Änderung Verzögerung | GUI grün: 1 → 2 → 3 → 7, zusätzlich Änderung über Codepad auf 9 | Abgesichert |
| GUI-05 | Codepad: Enter, danach Pfeil hoch wiederholt Eingabe; auch nach Terminalausgabe | GUI grün: Fokus und History nach Ausdruck und println | Abgesichert für diese Abläufe |
| GUI-06 | Terminal-Splitter reicht über gesamte Höhe; Ziehen verändert beide Bereiche korrekt | GUI grün: Höhe und Breiten beider Bereiche | Abgesichert bei 1440 × 1000 |
| GUI-07 | Alle Kotlin-Werte im Codepad haben bedienbaren roten Kasten und können auf die Bench | GUI grün: Int, String, eigene Klasse; Werte und Alias sichtbar | Weitere Typen noch ausbauen |
| GUI-08 | Editor öffnet fokussiert und ohne übergroßen Leerraum unter Close | GUI grün: Fokus, Abstand unter Close < 50 px | Visuelle Abnahme offen |
| GUI-09 | Bench/Codepad-Splitter springt beim ersten Ziehen nicht | Nutzerbestätigung + GUI grün für ersten und zweiten Drag | Abgesichert bei 1440 × 1000 |
| GUI-10 | Klasse umbenennen benennt Datei um, auch nach vorübergehend leerem Editor | GUI grün: Hund → Tier → leer → Katze; danach instanziiert | Abgesichert für Ersetzen des Editorinhalts |
| GUI-11 | Codepad ohne manuellen Compile: Ausdruck im leeren Projekt und mit Klassen ausführen | GUI grün mit echtem Worker | Abgesichert |
| GUI-12 | Terminal zeigt Eingabe blau zwischen vorheriger und nachfolgender Ausgabe | GUI grün: A, Eingabe, B, Ausgabe; Echo-Klasse vorhanden | Exakte Farbe noch visuell prüfen |
| GUI-13 | Clear leert alle Terminalinhalte sofort, auch im geteilten Terminal; App bleibt sichtbar; spätere Ausgabe funktioniert | GUI grün: Clear im Split-Terminal, Form Feed, danach neue Ausgabe | Abgesichert |
| GUI-14 | Print/println wird während laufender Schleife sichtbar | GUI grün: Ausgabe vor Schleifenende, danach Reset | Laufzeit prüft zusätzlich Einzelereignisse |
| GUI-15 | Keine EOF/Stop/Close-Leiste oder Hinweiszeile; aktives Eingabefeld farblich erkennbar | GUI grün: Eingabe aktiv/inaktiv, keine Hinweiszeile | Visuelle Details noch offen |
| GUI-16 | Files zeigt zunächst nur einen Hinweis-Popup ohne Funktionalität | GUI grün | Abgesichert |
| GUI-17 | Vorlagen erscheinen untereinander; Escape bricht Projekt-, Konstruktor- und Methodendialoge ab; Eingabefokus startet sinnvoll | GUI grün: 17/17 Chromium-Tests | Weitere visuelle Abnahmen offen |
| GUI-18 | Primitive Inspektoren zeigen ihren Typ, bleiben feldlos und werden beim Verschieben aktiviert; Escape schließt den aktiven Inspector | GUI grün: 18/18 Chromium-Tests | Weitere Typen noch ausbauen |
| GUI-19 | Codepad-Eingaben und Ergebnisse stehen mit kompaktem vertikalem Abstand wie im BlueJ-Stil | GUI-Test grün | Visuelle Abnahme offen |
| GUI-20 | Lange Codepad-Werte werden per CSS dynamisch einzeilig gekürzt, behalten den Typ sichtbar und zeigen den vollständigen Wert per Hover | GUI-Test grün | Visuelle Abnahme offen |
| GUI-21 | Dasselbe Codepad-Objekt kann unter mehreren Referenznamen auf der Objektbank abgelegt werden; der gemeinsame Inspector zeigt den jeweils aufgerufenen Referenznamen | GUI-Test grün | Visuelle Abnahme offen |
| GUI-22 | Obere Aktionen sind zu New Project, Open / Import, Save / Export und Files gebündelt; Open nutzt ein Drop-Feld, Save das New-Project-Layout und alle schalten gemeinsam auf Icon-only um | GUI-Test grün | Visuelle Abnahme offen |
| GUI-23 | Save / Export ist bei leerem Projekt bereits auf der Hauptleiste deaktiviert | GUI-Test grün | Abgesichert |
| RT-01 | Identität, Getter/Setter, Main, Reset, Input, veraltete Worker-Antworten bleiben korrekt | Bestehende Integrationstests | `test:runtime-state` |
| GUI-24 | Direkte Anweisungen in Projektdateien ergeben vor jeder Ausgabe einen Compilerfehler mit Dateiposition; auch Codepad kann den fehlgeschlagenen Compile nicht umgehen; direkte Codepad-Anweisungen bleiben erlaubt | GUI grün: echter Worker, Fehlerdialog mit Actions.kt/Zeile/Spalte, keine Terminalausgabe, Codepad nach Projektwechsel | Abgesichert in Chromium |
| GUI-25 | CodeMirror zeigt keine automatische Codevervollständigung und verwendet vier Leerzeichen für manuelle Einrückung; normale Editorfunktionen und Klammerergänzung bleiben erhalten | Chromium-Tests grün: 2/2; Typecheck grün | Abgesichert |
| GUI-26 | Cmd/Ctrl-Shift-I formatiert die komplette Kotlin-Datei mit dem lokal gebündelten ktfmt-WASM-Formatter im Hauptthread; komprimierte WASM-Auslieferung wird korrekt behandelt; normale Tab-/Shift-Tab-Einrückung bleibt separat | Chromium-Test grün: 2/2 für Ctrl und Cmd; Typecheck und Produktionsbuild grün | Abgesichert |
| GUI-27 | Kotlin-Editor bietet Maximieren, Schließen per `×` und einen Formatier-Button unten rechts mit Shortcut-Hinweis | Chromium-Test ergänzt; Formatieren, Maximieren und Schließen geprüft | Abgesichert |
| GUI-28 | Kotlin-Editor lässt sich wie das Terminal verschieben und an allen Seiten/Ecken in der Größe verändern; Codepad bleibt dabei sichtbar | Chromium-Test für Verschieben und Resize ergänzt | Abgesichert |
| GUI-29 | Kotlin-Editor verwendet die Terminal-Fensteroptik, zeigt Verschiebe-Cursor und hat keinen unnötigen Leerraum unter dem Editor | Chromium-Test für Stil, Cursor und unteren Abstand ergänzt | Abgesichert |
| GUI-30 | Editor und Terminal sind nicht modal; das zuletzt angeklickte Fenster liegt jeweils oben | Chromium-Test für Fensterfokus und aktiven Z-Index ergänzt | Abgesichert |
| GUI-31 | Pro Klasse bzw. Funktionsdatei kann ein eigenes Editorfenster geöffnet bleiben | Chromium-Test mit zwei gleichzeitig geöffneten Kotlin-Dateien ergänzt | Abgesichert |
| GUI-32 | Editor und Terminal verwenden identische Fenster-Buttons, gemeinsame Mindestgrößen und vollständig nutzbare Rahmenbereiche für Resize | Chromium-Test für Icons, 24-Pixel-Rahmenbereiche und Mindestgrößen ergänzt | Abgesichert |
| GUI-33 | Mehrere Editorfenster lassen sich zu einem Tab-Fenster sammeln, der aktive Tab ist durch seine mit dem Codefeld verbundene Hervorhebung eindeutig erkennbar, der vertikale Abstand unter den Fenster-Icons ist in beiden Modi gleich, Tabs lassen sich wechseln, über das Tab-Kreuz oder das X der Gruppe schließen und wieder in einzelne Fenster zerlegen | Chromium-Test für Sammeln, aktive Tab-Markierung, vertikalen Header-Abstand, Tabwechsel, Tab-Schließen, Gruppenschließen und Aufteilen ergänzt | Abgesichert |
| GUI-34 | Eine fehlgeschlagene Formatierung zeigt einen schließbaren Fehler; ein neuer Formatierungsversuch entfernt die alte Meldung vor dem erneuten Ergebnis | GUI-Test ergänzt | Abzusichern |
| RT-02 | Alle Projektdateien werden vor Initialisierung auf Deklarationen geprüft; Syntax-/Analysefehler verhindern Seiteneffekte; gültige Initialisierer und Codepad-Anweisungen bleiben ausführbar | Laufzeittest grün: mehrere Dateien, Aufruf/Zuweisung/Schleife/if/Literal, Syntax-/Typfehler, Initialisierung mit Eingabe, alle drei mitgelieferten Vorlagen | `test:runtime-state` |
| ARCH-01 | Inspektoransicht verändert keine Laufzeitdaten und ruft beim Rendern keine Getter auf | Modelltest grün | `test:inspector` |
| ARCH-02 | Parallele Getter-Refreshes nicht doppelt ausführen; alte Ergebnisse nach Reset/Schließen verwerfen | Modelltest grün | `test:inspector` |
| ARCH-03 | Fenster besitzen nur ID/Position, Feldwerte stammen aus Laufzeit plus typisiertem Getter-Modell | Refactoring umgesetzt, 16 GUI-Tests grün | Entwurf: `docs/architecture.md` |
| ARCH-04 | Projektdateien werden typisiert validiert und ohne Verlust von Dateien, Ressourcen oder Kartenpositionen importiert/exportiert | `test:project-format` grün; GUI 16/16 grün | Weitere historische Dateiformate nicht eingeführt |
| ARCH-05 | Codepad kompiliert bei Bedarf, führt nur nach erfolgreichem Compile aus und verwirft alte Generationen | `test:codepad-flow` grün; GUI 16/16 grün | Methodenaufrufe und BluePlay bewusst nicht Teil dieses Schritts |

## Letzter Prüflauf

2026-09-15: Nach dem Inspektor-Refactoring alle 16 GUI-Tests gemeinsam bestanden.
Neue Modelltests prüfen insbesondere Reset/Schließen während Getter-Aufrufen.
Typecheck (0 Fehler,
0 Warnungen), UI-Hilfsfunktionen, Runtime-Integration und Svelte-Produktionsbuild
ebenfalls erfolgreich. Chromium, 1440 × 1000, vorhandenes Kotlin-Bundle.

Dabei korrigiert: Codepad zeigte für Int/String mit Objekt-Handle nur `<object>`.
Es zeigt jetzt wieder den Wert samt Typ im bedienbaren Ergebnis-Button.
Die Suite prüft das auch nach Bindung an einen Bench-Namen.

2026-09-15: Projektformat und Compile-/Codepad-Ablauf schrittweise aus
`SvelteApp.svelte` ausgelagert. `test:project-format` und `test:codepad-flow`
prüfen Roundtrip/Validierung sowie Compile-on-demand und Generationsschutz.
Typecheck, UI-Helfer, Runtime-Integration, Inspector-Modell, Svelte-Build und
16 GUI-Tests erfolgreich. Der Entwicklungsserver lief auf
`http://127.0.0.1:5184`; Playwright verwendete den separaten Testserver auf
Port 5194.

2026-09-15: Vorlagenraster auf eine Spalte geändert und zentraler Escape-Abbruch
für relevante Fenster ergänzt. GUI-Suite erfolgreich mit 17/17 Chromium-Tests;
Typecheck und Svelte-Build erfolgreich.

2026-09-15: Lange Codepad-Werte werden mit sichtbarem Typ gekürzt; der vollständige
Wert steht als Hover-Text zur Verfügung. GUI-Suite erfolgreich mit 20/20 Chromium-
Tests; Typecheck und Svelte-Build erfolgreich.

2026-09-15: Projektdateien verwenden den deklarationsbasierten Ladeweg im
Kotlin-Adapter; Codepad bleibt ausführbar. Kotlin-Bundle neu gebaut,
Typecheck (0 Fehler/0 Warnungen), UI-/Inspector-/Projektformat-/Codepad-Helfertests,
Runtime-Integration, `browser-smoke` (Node/VM, kein echter Browser) und
Svelte-Produktionsbuild erfolgreich. Echter Chromium-Prüflauf: 24/24 GUI-Tests
bei 1440 × 1000 bestanden. Zusätzlich kompilieren alle drei JSON-Vorlagen über
den neuen Projekt-Ladeweg.

Erste Prüfläufe scheiterten an der Funktionsaufruf-Position (Klammer statt
Funktionsname, korrigiert) und am Projektwechsel im neuen GUI-Test (Hash-Wechsel
lädt die App nicht neu; anschließend fehlte die Bestätigung des Ersetzens).
Test nutzt jetzt den echten New-Project-Ablauf mit Bestätigung. Gradle- und
Testserver-Starts waren zunächst sandboxbedingt blockiert; mit freigegebenem
Cache-/Prozesszugriff erfolgreich wiederholt. Build-Warnungen zu Kotlin-Cast,
Bundlegröße und Worker-URL bleiben bestehen; keine visuelle Nutzerabnahme behauptet.

Offen bleiben die explizit genannten visuellen Abnahmen, weitere Datentypen,
Viewportgrößen und Browser. Die Liste bedeutet keine vollständige Feature-Parität.
